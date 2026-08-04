"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type CSSProperties, type ReactElement } from "react";

type IconProps = { className?: string };

export type NavLeaf = {
  href: string;
  label: string;
  desc?: string;
  icon: (props: IconProps) => ReactElement;
  exact?: boolean;
  /** Optional count badge (e.g. unread inbox). Hidden when 0 / undefined. */
  badge?: number;
};

function formatBadge(n: number): string {
  return n > 99 ? "99+" : String(n);
}

function NavBadge({
  count,
  active,
}: {
  count?: number;
  active?: boolean;
}) {
  if (!count || count <= 0) return null;
  return (
    <span
      className="ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums leading-none"
      style={{
        background: active
          ? "color-mix(in srgb, var(--role-nav-active-fg) 22%, transparent)"
          : "var(--role-nav-active)",
        color: active
          ? "var(--role-nav-active-fg)"
          : "var(--role-nav-active-fg)",
      }}
    >
      {formatBadge(count)}
    </span>
  );
}

export type NavGroup = {
  label: string;
  icon: (props: IconProps) => ReactElement;
  children: NavLeaf[];
  /** Start expanded even when no child is active. */
  defaultOpen?: boolean;
};

export type NavItem = NavLeaf | NavGroup;

function isGroup(item: NavItem): item is NavGroup {
  return "children" in item;
}

function leafActive(pathname: string, leaf: NavLeaf): boolean {
  if (leaf.exact) return pathname === leaf.href;
  return pathname === leaf.href || pathname.startsWith(`${leaf.href}/`);
}

function flatten(items: NavItem[]): NavLeaf[] {
  return items.flatMap((i) => (isGroup(i) ? i.children : [i]));
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-4 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
      style={{ color: "var(--role-nav-muted)" }}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function leafClasses(active: boolean): string {
  return `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
    active ? "shadow-sm" : ""
  }`;
}

function leafStyle(active: boolean): CSSProperties {
  return active
    ? {
        background: "var(--role-nav-active)",
        color: "var(--role-nav-active-fg)",
      }
    : { color: "var(--role-nav-muted)" };
}

export function DashboardNav({
  eyebrow,
  items,
  user,
  brand,
  topSlot,
  poweredBy,
  brandHref = "/",
}: {
  eyebrow: string;
  items: NavItem[];
  user: { name?: string | null; email?: string | null };
  brand?: { logoUrl?: string; logoText?: string; name?: string };
  topSlot?: React.ReactNode;
  /** Shown under the brand name (e.g. provider/tourist desks). */
  poweredBy?: string;
  brandHref?: string;
}) {
  const pathname = usePathname();
  const initial = (user.name || user.email || "?").charAt(0).toUpperCase();
  const logoUrl = brand?.logoUrl || "";
  const logoText = (brand?.logoText || "SH").slice(0, 2);
  const brandName = brand?.name || "Platform";

  return (
    <aside
      className="border-b backdrop-blur md:sticky md:top-0 md:flex md:h-dvh md:w-64 md:shrink-0 md:flex-col md:border-b-0 md:border-r"
      style={{
        background: "var(--role-sidebar)",
        borderColor: "var(--role-nav-border)",
      }}
    >
      {/* Brand + section label */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 md:block md:px-5 md:pb-3 md:pt-6">
        <Link href={brandHref} className="group flex min-w-0 items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={brandName}
              className="h-8 w-8 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold text-sand shadow-sm transition-transform group-hover:-rotate-6"
              style={{ background: "var(--role-brand-mark)" }}
            >
              {logoText}
            </span>
          )}
          <span className="min-w-0">
            <span
              className="block truncate font-display text-lg font-semibold tracking-tight"
              style={{ color: "var(--role-nav-fg)" }}
            >
              {brandName}
            </span>
            {poweredBy ? (
              <span
                className="mt-0.5 block truncate text-[0.65rem] font-medium tracking-wide"
                style={{ color: "var(--role-nav-muted)" }}
              >
                {poweredBy}
              </span>
            ) : null}
          </span>
        </Link>
        <p
          className="hidden text-[0.7rem] font-semibold uppercase tracking-[0.18em] md:mt-4 md:block"
          style={{ color: "var(--role-nav-muted)" }}
        >
          {eyebrow}
        </p>
        <Link
          href="/logout"
          className="rounded-md border px-3 py-1.5 text-xs font-medium transition md:hidden"
          style={{
            borderColor: "var(--role-nav-border)",
            color: "var(--role-nav-muted)",
          }}
        >
          Sign out
        </Link>
      </div>

      {topSlot}
      {/* Mobile: flat horizontal scroller — prioritize Today + Front desk leaves */}
      <nav className="flex gap-1 overflow-x-auto px-2 py-2 md:hidden">
        {flatten(items).map((leaf) => {
          const active = leafActive(pathname, leaf);
          const Icon = leaf.icon;
          return (
            <Link
              key={leaf.href}
              href={leaf.href}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              title={leaf.label}
              className="role-nav-link flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition"
              style={leafStyle(active)}
            >
              <Icon className="size-5 shrink-0" />
              {leaf.label}
              <NavBadge count={leaf.badge} active={active} />
            </Link>
          );
        })}
      </nav>

      {/* Desktop: grouped, collapsible */}
      <nav className="hidden md:block md:flex-1 md:space-y-0.5 md:overflow-y-auto md:px-3 md:py-1">
        {items.map((item) =>
          isGroup(item) ? (
            <NavGroupRow key={item.label} group={item} pathname={pathname} />
          ) : (
            <NavLeafRow key={item.href} leaf={item} pathname={pathname} />
          ),
        )}
      </nav>

      <div
        className="hidden border-t px-3 py-3 md:block"
        style={{ borderColor: "var(--role-nav-border)" }}
      >
        <div className="flex items-center gap-3 px-2 py-1">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-sand"
            style={{ background: "var(--role-brand-mark)" }}
          >
            {initial}
          </span>
          <span className="min-w-0">
            <span
              className="block text-[0.7rem] uppercase tracking-wider"
              style={{ color: "var(--role-nav-muted)" }}
            >
              Signed in
            </span>
            <span
              className="block truncate text-sm font-medium"
              style={{ color: "var(--role-nav-fg)" }}
            >
              {user.name || user.email}
            </span>
          </span>
        </div>
        <div className="mt-2 flex gap-2">
          <Link
            href="/"
            className="flex-1 rounded-md border px-3 py-1.5 text-center text-xs font-medium transition"
            style={{
              borderColor: "var(--role-nav-border)",
              color: "var(--role-nav-muted)",
            }}
          >
            View site
          </Link>
          <Link
            href="/logout"
            className="flex-1 rounded-md px-3 py-1.5 text-center text-xs font-medium transition hover:brightness-110"
            style={{
              background: "var(--role-nav-active)",
              color: "var(--role-nav-active-fg)",
            }}
          >
            Sign out
          </Link>
        </div>
      </div>
    </aside>
  );
}

function NavLeafRow({ leaf, pathname }: { leaf: NavLeaf; pathname: string }) {
  const active = leafActive(pathname, leaf);
  const Icon = leaf.icon;
  return (
    <Link
      href={leaf.href}
      prefetch={false}
      aria-current={active ? "page" : undefined}
      title={leaf.label}
      className={`${leafClasses(active)} role-nav-link`}
      style={leafStyle(active)}
    >
      <span
        className="shrink-0 transition-colors"
        style={{
          color: active ? "var(--role-nav-active-fg)" : "var(--role-nav-muted)",
        }}
      >
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium leading-tight">{leaf.label}</span>
        {leaf.desc && (
          <span
            className="text-xs leading-tight"
            style={{
              color: active
                ? "color-mix(in srgb, var(--role-nav-active-fg) 75%, transparent)"
                : "var(--role-nav-muted)",
            }}
          >
            {leaf.desc}
          </span>
        )}
      </span>
      <NavBadge count={leaf.badge} active={active} />
    </Link>
  );
}

function NavGroupRow({
  group,
  pathname,
}: {
  group: NavGroup;
  pathname: string;
}) {
  const hasActiveChild = group.children.some((c) => leafActive(pathname, c));
  const hasBadge = group.children.some((c) => (c.badge ?? 0) > 0);
  const [open, setOpen] = useState(
    hasActiveChild || hasBadge || Boolean(group.defaultOpen),
  );
  const Icon = group.icon;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="role-nav-link flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition"
        style={{
          color: hasActiveChild ? "var(--role-nav-fg)" : "var(--role-nav-muted)",
        }}
      >
        <span
          className="shrink-0"
          style={{
            color: hasActiveChild
              ? "var(--role-nav-active)"
              : "var(--role-nav-muted)",
          }}
        >
          <Icon className="size-5" />
        </span>
        <span className="flex-1 text-left font-medium leading-tight">
          {group.label}
        </span>
        <Chevron open={open} />
      </button>
      {open && (
        <div
          className="mb-1 ml-4 space-y-0.5 border-l pl-2"
          style={{ borderColor: "var(--role-nav-border)" }}
        >
          {group.children.map((child) => {
            const active = leafActive(pathname, child);
            return (
              <Link
                key={child.href}
                href={child.href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className="role-nav-link flex items-center gap-2 rounded-md px-3 py-2 text-sm transition"
                style={leafStyle(active)}
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{
                    background: active
                      ? "var(--role-nav-active-fg)"
                      : "var(--role-nav-border)",
                  }}
                />
                <span className="min-w-0 flex-1 truncate">{child.label}</span>
                <NavBadge count={child.badge} active={active} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
