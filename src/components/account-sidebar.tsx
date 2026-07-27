"use client";

import { DashboardNav, type NavItem } from "@/components/dashboard-nav";

const overviewIcon = (p: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5 10v10h14V10" />
    <path d="M9.5 20v-6h5v6" />
  </svg>
);
const travelIcon = (p: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="M3 7h18v12H3z" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M3 12h18" />
  </svg>
);
const rewardsIcon = (p: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8z" />
  </svg>
);
const accountIcon = (p: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </svg>
);
const leafIcon = (p: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="M4 12h16" />
  </svg>
);

/**
 * Traveler desk IA — same shape as provider/admin:
 * Today → Travel → Rewards → Account
 */
const ITEMS: NavItem[] = [
  {
    href: "/account",
    label: "Today",
    desc: "Trips & bookings",
    exact: true,
    icon: overviewIcon,
  },
  {
    label: "Travel",
    icon: travelIcon,
    defaultOpen: true,
    children: [
      {
        href: "/account/messages",
        label: "Messages",
        desc: "Ask providers",
        icon: leafIcon,
      },
      {
        href: "/account/saved",
        label: "Saved",
        desc: "Wishlist",
        icon: leafIcon,
      },
    ],
  },
  {
    label: "Rewards",
    icon: rewardsIcon,
    children: [
      {
        href: "/account/loyalty",
        label: "Loyalty",
        desc: "Points & rewards",
        icon: leafIcon,
      },
    ],
  },
  {
    label: "Account",
    icon: accountIcon,
    children: [
      {
        href: "/account/profile",
        label: "Profile",
        desc: "Details & password",
        icon: leafIcon,
      },
    ],
  },
];

export function AccountSidebar({
  user,
  brand,
}: {
  user: { name?: string | null; email?: string | null };
  brand?: { logoUrl?: string; logoText?: string; name?: string };
}) {
  return (
    <DashboardNav
      eyebrow="Traveler desk"
      items={ITEMS}
      user={user}
      brand={brand}
      brandHref="/account"
      poweredBy="Powered by Safari Hub"
    />
  );
}
