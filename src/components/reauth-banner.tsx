"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function BannerInner() {
  const params = useSearchParams();
  if (params.get("login") !== "1") return null;

  return (
    <div className="border-b border-line bg-sand px-4 py-3 text-center text-sm text-ink">
      Sign in again to continue — sessions stay in the tab where you logged in.{" "}
      <Link href="/login" className="font-semibold underline">
        Log in
      </Link>
    </div>
  );
}

export function ReauthBanner() {
  return (
    <Suspense fallback={null}>
      <BannerInner />
    </Suspense>
  );
}
