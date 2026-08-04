"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { TAB_BIND_HEADER, readTabBind } from "@/lib/tab-session";

function TabBindFetchPatch({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const original = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const isApi =
        typeof url === "string" &&
        (url.startsWith("/api/") ||
          url.startsWith(`${window.location.origin}/api/`));
      if (!isApi) return original(input, init);

      const bind = readTabBind();
      if (!bind) return original(input, init);

      const headers = new Headers(
        init?.headers ||
          (input instanceof Request ? input.headers : undefined),
      );
      if (!headers.has(TAB_BIND_HEADER)) {
        headers.set(TAB_BIND_HEADER, bind);
      }
      return original(input, { ...init, headers });
    };
    return () => {
      window.fetch = original;
    };
  }, []);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <TabBindFetchPatch>{children}</TabBindFetchPatch>
    </SessionProvider>
  );
}
