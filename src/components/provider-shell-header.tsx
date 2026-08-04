"use client";

import { NotificationBell } from "@/components/notification-bell";

/** Top bar inside the provider desk shell (notifications live here, not public header). */
export function ProviderShellHeader({
  businessName,
}: {
  businessName?: string | null;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line/80 bg-sand/90 px-4 py-2.5 backdrop-blur-md md:px-6">
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
          Desk
        </p>
        <p className="truncate text-sm font-medium text-ink">
          {businessName?.trim() || "Your business"}
        </p>
      </div>
      <NotificationBell />
    </header>
  );
}
