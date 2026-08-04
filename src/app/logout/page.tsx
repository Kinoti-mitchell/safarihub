"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";
import { clearTabBind } from "@/lib/tab-session";

export default function LogoutPage() {
  useEffect(() => {
    clearTabBind();
    void signOut({ callbackUrl: "/" });
  }, []);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-ink-muted">
      Signing out…
    </div>
  );
}
