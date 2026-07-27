"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { staffCanAccessPath } from "@/lib/staff-roles";

/** Blocks provider routes the active membership role cannot use. */
export function ProviderRoleGate({
  role,
  children,
}: {
  role: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/provider";
  if (staffCanAccessPath(role, pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-8">
      <div className="rounded-xl border border-line bg-white/80 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
          Access limited
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-lake">
          Your role cannot open this page
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          As{" "}
          <span className="font-medium text-ink">
            {role.replace("_", " ").toLowerCase()}
          </span>
          , you only see tools assigned to that role. Ask an owner or manager if
          you need broader access.
        </p>
        <Link
          href="/provider"
          className="mt-6 inline-flex rounded-md bg-lake px-4 py-2.5 text-sm font-semibold text-sand transition hover:bg-lake-bright"
        >
          Back to Today
        </Link>
      </div>
    </div>
  );
}
