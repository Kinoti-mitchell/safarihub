"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative rounded-md px-2 py-2 transition-colors sm:px-3 ${
        active
          ? "text-lake"
          : "text-ink-muted hover:bg-sand hover:text-ink"
      } ${className}`}
    >
      {children}
      <span
        className={`pointer-events-none absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-sun transition-transform duration-200 sm:inset-x-3 ${
          active ? "scale-x-100" : "scale-x-0"
        }`}
      />
    </Link>
  );
}
