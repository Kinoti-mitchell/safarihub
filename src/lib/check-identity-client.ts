/** Call /api/auth/check-identity and map clashes to field → message. */
export async function checkIdentityFields(input: {
  email?: string | null;
  phone?: string | null;
  idNumber?: string | null;
  registrationNumber?: string | null;
  kraPin?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  excludeProviderId?: string | null;
}): Promise<{ ok: boolean; fieldErrors: Record<string, string> }> {
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value == null || value === "") continue;
    body[key] = value;
  }
  if (Object.keys(body).length === 0) {
    return { ok: true, fieldErrors: {} };
  }

  try {
    const res = await fetch("/api/auth/check-identity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        fieldErrors: { form: data.error || "Could not verify details" },
      };
    }
    const fieldErrors =
      data.fieldErrors && typeof data.fieldErrors === "object"
        ? (data.fieldErrors as Record<string, string>)
        : {};
    return { ok: Boolean(data.ok), fieldErrors };
  } catch {
    return {
      ok: false,
      fieldErrors: { form: "Network error — could not verify details" },
    };
  }
}
