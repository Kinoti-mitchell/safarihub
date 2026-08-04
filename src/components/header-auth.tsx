"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { NavLink } from "@/components/nav-link";
import { NotificationBell } from "@/components/notification-bell";
import { readTabBind } from "@/lib/tab-session";

/**
 * Header login/account controls. When tab-binding is on, a tab that did not
 * log in is treated as signed out in the chrome (even if the cookie exists).
 */
export function HeaderAuth({
  dash,
  loginLabel,
  joinLabel,
  myTripsLabel,
  bindSessionToTab,
}: {
  dash: string;
  loginLabel: string;
  joinLabel: string;
  myTripsLabel: string;
  bindSessionToTab: boolean;
}) {
  const { data: session, status } = useSession();
  const [tabOk, setTabOk] = useState(!bindSessionToTab);

  useEffect(() => {
    if (!bindSessionToTab) {
      setTabOk(true);
      return;
    }
    setTabOk(Boolean(readTabBind()));
  }, [bindSessionToTab, status, session?.user?.id]);

  const signedIn = status === "authenticated" && session?.user && tabOk;

  if (signedIn) {
    return (
      <>
        <NotificationBell />
        <NavLink href={dash}>
          {session.user.role === "TOURIST" ? myTripsLabel : "Dashboard"}
        </NavLink>
        <Link
          href="/logout"
          className="rounded-full bg-lake px-3.5 py-2 text-sand shadow-sm transition hover:bg-lake-bright hover:shadow-md"
        >
          Sign out
        </Link>
      </>
    );
  }

  return (
    <>
      <NavLink href="/login">{loginLabel}</NavLink>
      <Link
        href="/register"
        className="rounded-full bg-sun px-3.5 py-2 text-ink shadow-sm transition hover:brightness-110"
      >
        {joinLabel}
      </Link>
    </>
  );
}
