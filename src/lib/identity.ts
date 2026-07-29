import { db } from "@/lib/supabase";

/** Lowercase trimmed email. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const KENYAN_PHONE_ERROR =
  "Enter a valid Kenyan phone number with at least 10 digits (e.g. 0712 345 678 or +254 712 345 678)";

/**
 * Normalize a standard Kenyan phone to 2547XXXXXXXX / 2541XXXXXXXX.
 * Requires at least 10 digits (local 07… / 01…) or full 254… international form.
 * Returns null if empty or invalid.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (phone == null) return null;
  const raw = String(phone).trim();
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;

  let normalized: string | null = null;
  if (digits.startsWith("254")) {
    // +254 7XX XXX XXX → 12 digits
    if (digits.length < 12) return null;
    normalized = digits.slice(0, 12);
  } else if (digits.startsWith("0")) {
    // 07XX XXX XXX or 01XX XXX XXX → 10 digits local
    if (digits.length < 10) return null;
    normalized = `254${digits.slice(1, 10)}`;
  } else if (digits.startsWith("7") || digits.startsWith("1")) {
    // Allow 10+ digit forms that omitted the leading 0 but included extra noise;
    // still require ≥10 digits overall from the caller path above.
    if (digits.length < 10) return null;
    normalized = `254${digits.slice(0, 9)}`;
  } else {
    return null;
  }

  // Safaricom / Airtel / Telkom mobile (7) and some 1xx ranges
  if (!/^254[17]\d{8}$/.test(normalized)) return null;
  return normalized;
}

/**
 * Validate optional/required Kenyan phone. Empty is OK unless required.
 */
export function validateKenyanPhone(
  phone: string | null | undefined,
  opts?: { required?: boolean },
): { phone: string | null; error?: string } {
  const raw = phone == null ? "" : String(phone).trim();
  if (!raw) {
    if (opts?.required) {
      return { phone: null, error: KENYAN_PHONE_ERROR };
    }
    return { phone: null };
  }
  const digitCount = raw.replace(/\D/g, "").length;
  if (digitCount < 10) {
    return {
      phone: null,
      error:
        "Phone number must be at least 10 digits (Kenyan format, e.g. 0712345678)",
    };
  }
  const normalized = normalizePhone(raw);
  if (!normalized) {
    return { phone: null, error: KENYAN_PHONE_ERROR };
  }
  return { phone: normalized };
}

/** National ID / passport — uppercase, alphanumeric only. */
export function normalizeIdNumber(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return cleaned.length >= 3 ? cleaned : null;
}

/** Company registration / certificate number. */
export function normalizeRegistrationNumber(
  value: string | null | undefined,
): string | null {
  return normalizeIdNumber(value);
}

export type IdentityClash = {
  field:
    | "email"
    | "phone"
    | "idNumber"
    | "registrationNumber"
    | "kraPin"
    | "location";
  message: string;
};

/**
 * Ensure identity fields are not already used by a *different* user.
 * - email / phone → User table
 * - idNumber / registrationNumber / kraPin → Provider table
 * - optional nearby GPS duplicate (~150m)
 */
export async function findIdentityClash(input: {
  email?: string | null;
  phone?: string | null;
  idNumber?: string | null;
  registrationNumber?: string | null;
  kraPin?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Current user id — their own records are allowed. */
  excludeUserId?: string | null;
  /** Current provider id — that business is allowed when updating. */
  excludeProviderId?: string | null;
}): Promise<IdentityClash | null> {
  const email = input.email ? normalizeEmail(input.email) : null;
  const phone = normalizePhone(input.phone);
  const idNumber = normalizeIdNumber(input.idNumber);
  const registrationNumber = normalizeRegistrationNumber(
    input.registrationNumber,
  );
  const kraPin = input.kraPin
    ? String(input.kraPin).trim().toUpperCase().replace(/[\s-]/g, "")
    : null;

  if (email) {
    let q = db.from("User").select("id").eq("email", email);
    if (input.excludeUserId) q = q.neq("id", input.excludeUserId);
    const { data } = await q.maybeSingle();
    if (data) {
      return {
        field: "email",
        message: "An account with this email already exists",
      };
    }
  }

  if (phone) {
    // Match common stored variants for older rows that were not normalized.
    const variants = phoneVariants(phone);
    let q = db.from("User").select("id, phone").in("phone", variants);
    if (input.excludeUserId) q = q.neq("id", input.excludeUserId);
    const { data } = await q.limit(1).maybeSingle();
    if (data) {
      return {
        field: "phone",
        message: "An account with this phone number already exists",
      };
    }

    // Also block if another provider (different owner) already uses the phone.
    const { data: providerPhoneRows } = await db
      .from("Provider")
      .select("id, phone")
      .in("phone", variants)
      .limit(20);
    if (providerPhoneRows?.length) {
      for (const row of providerPhoneRows) {
        if (
          input.excludeProviderId &&
          row.id === input.excludeProviderId
        ) {
          continue;
        }
        const ownedByOther = await providerOwnedByOtherUser(
          row.id as string,
          input.excludeUserId,
        );
        if (ownedByOther) {
          return {
            field: "phone",
            message: "This phone number is already used by another account",
          };
        }
      }
    }
  }

  if (idNumber) {
    const clash = await findProviderKycClash({
      column: "idNumber",
      value: idNumber,
      excludeUserId: input.excludeUserId,
      excludeProviderId: input.excludeProviderId,
      message: "A provider with this national ID already exists",
    });
    if (clash) return clash;
  }

  if (registrationNumber) {
    // Company registration is unique system-wide (one certificate → one business).
    let q = db
      .from("Provider")
      .select("id")
      .in("registrationNumber", [
        registrationNumber,
        registrationNumber.toLowerCase(),
        registrationNumber.toUpperCase(),
      ])
      .limit(1);
    if (input.excludeProviderId) q = q.neq("id", input.excludeProviderId);
    const { data: regClash } = await q.maybeSingle();
    if (regClash) {
      return {
        field: "registrationNumber",
        message:
          "A provider with this company registration number already exists",
      };
    }
  }

  if (kraPin && /^[A-Z]\d{9}[A-Z]$/.test(kraPin)) {
    let q = db.from("Provider").select("id").eq("kraPin", kraPin).limit(20);
    if (input.excludeProviderId) q = q.neq("id", input.excludeProviderId);
    const { data: rows } = await q;
    for (const row of rows ?? []) {
      const ownedByOther = await providerOwnedByOtherUser(
        row.id as string,
        input.excludeUserId,
      );
      if (ownedByOther) {
        return {
          field: "kraPin",
          message: "A provider with this KRA PIN already exists",
        };
      }
    }
  }

  if (
    input.latitude != null &&
    input.longitude != null &&
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude)
  ) {
    const nearby = await findNearbyProviderDuplicate({
      latitude: input.latitude,
      longitude: input.longitude,
      excludeProviderId: input.excludeProviderId,
      excludeUserId: input.excludeUserId,
    });
    if (nearby) return nearby;
  }

  return null;
}

/** ~150m box check for same premises registered by another account. */
async function findNearbyProviderDuplicate(opts: {
  latitude: number;
  longitude: number;
  excludeProviderId?: string | null;
  excludeUserId?: string | null;
}): Promise<IdentityClash | null> {
  // ~0.0015 deg ≈ 150–170m near equator
  const delta = 0.0015;
  let q = db
    .from("Provider")
    .select("id, latitude, longitude, name")
    .gte("latitude", opts.latitude - delta)
    .lte("latitude", opts.latitude + delta)
    .gte("longitude", opts.longitude - delta)
    .lte("longitude", opts.longitude + delta)
    .limit(20);
  if (opts.excludeProviderId) q = q.neq("id", opts.excludeProviderId);
  const { data: rows } = await q;
  for (const row of rows ?? []) {
    if (row.latitude == null || row.longitude == null) continue;
    const ownedByOther = await providerOwnedByOtherUser(
      row.id as string,
      opts.excludeUserId,
    );
    if (ownedByOther) {
      return {
        field: "location",
        message: `Another business is already registered very near this location (${row.name || "provider"})`,
      };
    }
  }
  return null;
}

export function phoneVariants(normalized: string): string[] {
  const local = normalized.startsWith("254")
    ? `0${normalized.slice(3)}`
    : normalized;
  const plus = normalized.startsWith("254") ? `+${normalized}` : normalized;
  return Array.from(new Set([normalized, local, plus, `+${normalized}`]));
}

async function providerOwnedByOtherUser(
  providerId: string,
  excludeUserId?: string | null,
): Promise<boolean> {
  const { data: members } = await db
    .from("ProviderMember")
    .select("userId, role")
    .eq("providerId", providerId);
  if (!members?.length) return true;
  const owners = members.filter(
    (m) => m.role === "OWNER" || m.role === "PROVIDER",
  );
  const userIds = (owners.length ? owners : members).map(
    (m) => m.userId as string,
  );
  if (!excludeUserId) return true;
  return userIds.some((uid) => uid !== excludeUserId);
}

async function findProviderKycClash(opts: {
  column: "idNumber" | "registrationNumber";
  value: string;
  excludeUserId?: string | null;
  excludeProviderId?: string | null;
  message: string;
}): Promise<IdentityClash | null> {
  // Exact + common casing variants (we store normalized uppercase going forward).
  const variants = Array.from(
    new Set([opts.value, opts.value.toLowerCase(), opts.value.toUpperCase()]),
  );
  let q = db
    .from("Provider")
    .select("id")
    .in(opts.column, variants)
    .limit(20);
  if (opts.excludeProviderId) q = q.neq("id", opts.excludeProviderId);
  const { data: rows } = await q;
  if (!rows?.length) return null;

  for (const row of rows) {
    const ownedByOther = await providerOwnedByOtherUser(
      row.id as string,
      opts.excludeUserId,
    );
    if (ownedByOther) {
      return {
        field: opts.column,
        message: opts.message,
      };
    }
  }
  return null;
}

/**
 * Check each provided identity field independently and return every clash.
 * Used for stepwise registration so users see field errors before advancing.
 */
export async function findAllIdentityClashes(input: {
  email?: string | null;
  phone?: string | null;
  idNumber?: string | null;
  registrationNumber?: string | null;
  kraPin?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  excludeUserId?: string | null;
  excludeProviderId?: string | null;
}): Promise<IdentityClash[]> {
  const checks: Array<Promise<IdentityClash | null>> = [];

  if (input.email?.trim()) {
    checks.push(
      findIdentityClash({
        email: input.email,
        excludeUserId: input.excludeUserId,
        excludeProviderId: input.excludeProviderId,
      }),
    );
  }
  if (input.phone?.trim()) {
    checks.push(
      findIdentityClash({
        phone: input.phone,
        excludeUserId: input.excludeUserId,
        excludeProviderId: input.excludeProviderId,
      }),
    );
  }
  if (input.idNumber?.trim()) {
    checks.push(
      findIdentityClash({
        idNumber: input.idNumber,
        excludeUserId: input.excludeUserId,
        excludeProviderId: input.excludeProviderId,
      }),
    );
  }
  if (input.registrationNumber?.trim()) {
    checks.push(
      findIdentityClash({
        registrationNumber: input.registrationNumber,
        excludeUserId: input.excludeUserId,
        excludeProviderId: input.excludeProviderId,
      }),
    );
  }
  if (input.kraPin?.trim()) {
    checks.push(
      findIdentityClash({
        kraPin: input.kraPin,
        excludeUserId: input.excludeUserId,
        excludeProviderId: input.excludeProviderId,
      }),
    );
  }
  if (
    input.latitude != null &&
    input.longitude != null &&
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude)
  ) {
    checks.push(
      findIdentityClash({
        latitude: input.latitude,
        longitude: input.longitude,
        excludeUserId: input.excludeUserId,
        excludeProviderId: input.excludeProviderId,
      }),
    );
  }

  const results = await Promise.all(checks);
  const byField = new Map<IdentityClash["field"], IdentityClash>();
  for (const clash of results) {
    if (!clash) continue;
    if (!byField.has(clash.field)) byField.set(clash.field, clash);
  }
  return Array.from(byField.values());
}
