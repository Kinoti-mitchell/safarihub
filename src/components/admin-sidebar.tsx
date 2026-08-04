"use client";

import { DashboardNav, type NavItem } from "@/components/dashboard-nav";

const overviewIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5 10v10h14V10" />
    <path d="M9.5 20v-6h5v6" />
  </svg>
);
const queueIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M4 12l5 5L20 6" />
  </svg>
);
const catalogIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M4 7h16l-1.2 12.2A2 2 0 0 1 16.81 21H7.19a2 2 0 0 1-1.99-1.8L4 7Z" />
    <path d="M9 7V5a3 3 0 0 1 6 0v2" />
  </svg>
);
const moneyIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
);
const growthIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M4 20V4M4 20h16" />
    <path d="M8 16v-4M12 16V7M16 16v-6" />
  </svg>
);
const platformIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" />
  </svg>
);
const leafIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M4 12h16" />
  </svg>
);

/**
 * Admin IA mirrors the provider desk:
 * Today → Work queue → Catalog → Money → Growth → Platform
 */
const ITEMS: NavItem[] = [
  {
    href: "/admin",
    label: "Today",
    desc: "Overview & trends",
    exact: true,
    icon: overviewIcon,
  },
  {
    label: "Work queue",
    icon: queueIcon,
    defaultOpen: true,
    children: [
      {
        href: "/admin/approvals",
        label: "Pending approvals",
        desc: "Providers & listings",
        icon: leafIcon,
        exact: true,
      },
      {
        href: "/admin/approvals/approved",
        label: "Approved",
        desc: "Live businesses",
        icon: leafIcon,
      },
      {
        href: "/admin/inbox",
        label: "Inbox",
        desc: "Inquiries & alerts",
        icon: leafIcon,
      },
      {
        href: "/admin/reviews",
        label: "Reviews",
        desc: "Ratings & moderation",
        icon: leafIcon,
      },
    ],
  },
  {
    label: "Catalog",
    icon: catalogIcon,
    children: [
      {
        href: "/admin/listings",
        label: "Listings",
        desc: "All inventory",
        icon: leafIcon,
      },
      {
        href: "/admin/categories",
        label: "Categories",
        desc: "Amenities & labels",
        icon: leafIcon,
      },
      {
        href: "/admin/content",
        label: "Events & packages",
        desc: "Curated content",
        icon: leafIcon,
      },
      {
        href: "/admin/markets",
        label: "Markets",
        desc: "Counties & towns",
        icon: leafIcon,
      },
    ],
  },
  {
    label: "Money & ops",
    icon: moneyIcon,
    children: [
      {
        href: "/admin/bookings",
        label: "Bookings",
        desc: "Platform reservations",
        icon: leafIcon,
      },
      {
        href: "/admin/payments",
        label: "Payments desk",
        desc: "STK, refunds, exceptions",
        icon: leafIcon,
      },
      {
        href: "/admin/payouts",
        label: "Payouts",
        desc: "Settlements & batch B2C",
        icon: leafIcon,
      },
      {
        href: "/admin/disputes",
        label: "Disputes",
        desc: "Holds & resolutions",
        icon: leafIcon,
      },
      {
        href: "/admin/etims",
        label: "eTIMS",
        desc: "Fiscal queue",
        icon: leafIcon,
      },
      {
        href: "/admin/suppliers",
        label: "Suppliers",
        desc: "B2B orders",
        icon: leafIcon,
      },
      {
        href: "/admin/boost",
        label: "Boosts",
        desc: "Rates & approvals",
        icon: leafIcon,
      },
    ],
  },
  {
    label: "Growth",
    icon: growthIcon,
    children: [
      {
        href: "/admin/reports",
        label: "Insights",
        desc: "Tourism & platform data",
        icon: leafIcon,
      },
      {
        href: "/admin/ads",
        label: "Ads & broadcasts",
        desc: "Push to users",
        icon: leafIcon,
      },
    ],
  },
  {
    label: "Platform",
    icon: platformIcon,
    children: [
      {
        href: "/admin/users",
        label: "Users",
        desc: "Accounts",
        icon: leafIcon,
      },
      {
        href: "/admin/roles",
        label: "Roles",
        desc: "Permissions",
        icon: leafIcon,
      },
      {
        href: "/admin/logs",
        label: "Activity logs",
        desc: "Audit trail",
        icon: leafIcon,
      },
      {
        href: "/admin/settings",
        label: "Settings",
        desc: "Platform config",
        icon: leafIcon,
      },
      {
        href: "/admin/profile",
        label: "My profile",
        desc: "Login details",
        icon: leafIcon,
      },
    ],
  },
];

export function AdminSidebar({
  user,
  brand,
}: {
  user: { name?: string | null; email?: string | null };
  brand?: { logoUrl?: string; logoText?: string; name?: string };
}) {
  return (
    <DashboardNav
      eyebrow="Control room"
      items={ITEMS}
      user={user}
      brand={brand}
      brandHref="/admin"
      poweredBy={`Powered by ${brand?.name || "Platform"}`}
    />
  );
}
