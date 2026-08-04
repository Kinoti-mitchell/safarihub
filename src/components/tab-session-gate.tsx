"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { readTabBind } from "@/lib/tab-session";

/**
 * Blocks dashboard UI in a tab that did not perform login.
 * Cookies are shared across tabs; sessionStorage is not — so a copied link
 * in a new tab fails this check and is sent to the landing page.
 * Does NOT call signOut(), so other tabs that logged in keep working.
 */
export function TabSessionGate({
  children,
  enabled = true,
}: {
  children: React.ReactNode;
  enabled?: boolean;
}) {
  const { data: session, status } = useSession();
  const [ok, setOk] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setOk(true);
      return;
    }
    if (status === "loading") return;

    if (status === "unauthenticated" || !session?.user) {
      window.location.replace("/?login=1");
      return;
    }

    // This tab must have logged in (sessionStorage is per-tab).
    if (!readTabBind()) {
      window.location.replace("/?login=1");
      return;
    }

    setOk(true);
  }, [enabled, session, status]);

  if (!ok) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4 text-sm text-ink-muted">
        Checking session…
      </div>
    );
  }

  return <>{children}</>;
}
