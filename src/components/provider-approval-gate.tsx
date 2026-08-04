"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Routes a pending (unapproved) provider may still open. */
const ALLOWED_WHILE_PENDING = [
  "/provider",
  "/provider/profile",
  "/provider/business",
  "/provider/businesses",
  "/provider/compliance",
];

function isAllowedWhilePending(pathname: string): boolean {
  return ALLOWED_WHILE_PENDING.some(
    (p) => pathname === p || (p !== "/provider" && pathname.startsWith(`${p}/`)),
  );
}

export function ProviderApprovalGate({
  approved,
  businessName,
  platformName = "Platform",
  children,
}: {
  approved: boolean;
  businessName?: string | null;
  platformName?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/provider";

  if (approved || isAllowedWhilePending(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-8">
      <div className="rounded-xl border border-sun/40 bg-sun/10 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
          Approval required
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-lake">
          Your business is under review
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink">
          {businessName ? (
            <>
              <span className="font-semibold">{businessName}</span> is waiting for{" "}
              {platformName} admin approval.
            </>
          ) : (
            <>Your business is waiting for {platformName} admin approval.</>
          )}{" "}
          You can update your profile, business details, and KYC while you wait.
          Listing properties, inviting staff, taking bookings, and suppliers
          unlock after approval.
        </p>
        <p className="mt-3 text-sm text-ink-muted">
          You will get a confirmation in your notification bell (and email, if
          configured) once an admin approves you.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/provider"
            className="rounded-md bg-lake px-4 py-2.5 text-sm font-semibold text-sand transition hover:bg-lake-bright"
          >
            Back to hub
          </Link>
          <Link
            href="/provider/compliance"
            className="rounded-md border border-line bg-white/80 px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-sand"
          >
            Check KYC status
          </Link>
        </div>
      </div>
    </div>
  );
}
