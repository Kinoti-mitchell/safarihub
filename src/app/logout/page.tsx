"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";

export default function LogoutPage() {
  useEffect(() => {
    void signOut({ callbackUrl: "/" });
  }, []);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-ink-muted">
      Signing out…
    </div>
  );
}
