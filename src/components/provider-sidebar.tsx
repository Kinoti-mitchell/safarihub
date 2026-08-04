"use client";

import { BusinessSwitcher } from "@/components/business-switcher";
import {
  DashboardNav,
  type NavGroup,
  type NavItem,
  type NavLeaf,
} from "@/components/dashboard-nav";
import { staffCanAccessPath, type StaffRole } from "@/lib/staff-roles";

const overviewIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5 10v10h14V10" />
    <path d="M9.5 20v-6h5v6" />
  </svg>
);
const todayIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18" />
    <path d="M8 2v4M16 2v4" />
  </svg>
);
const sellIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M4 7h16l-1.2 12.2A2 2 0 0 1 16.81 21H7.19a2 2 0 0 1-1.99-1.8L4 7Z" />
    <path d="M9 7V5a3 3 0 0 1 6 0v2" />
  </svg>
);
const opsIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 7 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 2.6 15H2.5a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 7a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 2.6h.09A1.65 1.65 0 0 0 11 1v-.09" />
  </svg>
);
const financeIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
);
const settingsIcon = (p: { className?: string }) => (
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

export type ProviderNavBadges = {
  bookings?: number;
  inbox?: number;
};

function isGroup(item: NavItem): item is NavGroup {
  return "children" in item;
}

function isTourOps(businessType?: string | null): boolean {
  return (
    businessType === "TOUR_OPERATOR" ||
    businessType === "TRANSFER" ||
    businessType === "CAMP"
  );
}

function buildItems(
  badges?: ProviderNavBadges,
  businessType?: string | null,
  flags?: { suppliersEnabled?: boolean; staffingEnabled?: boolean },
): NavItem[] {
  const tour = isTourOps(businessType);
  const suppliersEnabled = flags?.suppliersEnabled !== false;
  const staffingEnabled = flags?.staffingEnabled !== false;
  return [
    {
      href: "/provider",
      label: "Today",
      desc: "What needs attention",
      exact: true,
      icon: overviewIcon,
    },
    {
      label: tour ? "Operations" : "Front desk",
      icon: todayIcon,
      defaultOpen: true,
      children: [
        {
          href: "/provider/bookings",
          label: "Bookings",
          desc: tour ? "Departures & guests" : "Confirm & collect",
          icon: leafIcon,
          badge: badges?.bookings,
        },
        {
          href: "/provider/inbox",
          label: "Inbox",
          desc: tour ? "Messages & leads" : "Guest messages",
          icon: leafIcon,
          badge: badges?.inbox,
        },
        {
          href: "/provider/reviews",
          label: "Reviews",
          desc: "Reputation",
          icon: leafIcon,
        },
      ],
    },
    {
      label: "Sell",
      icon: sellIcon,
      children: [
        {
          href: "/provider/listings",
          label: tour ? "Tours & activities" : "Listings",
          desc: tour ? "Day trips & experiences" : "Storefront",
          icon: leafIcon,
        },
        {
          href: "/provider/packages",
          label: "Packages",
          desc: "Multi-day itineraries",
          icon: leafIcon,
        },
      ],
    },
    {
      label: tour ? "Run operations" : "Run the house",
      icon: opsIcon,
      children: [
        ...(staffingEnabled
          ? [
              {
                href: "/provider/staff",
                label: "Staff",
                desc: tour ? "Guides & desk" : "Register & assign",
                icon: leafIcon,
              } satisfies NavLeaf,
            ]
          : []),
        ...(suppliersEnabled
          ? [
              {
                href: "/provider/suppliers",
                label: "Suppliers",
                desc: "Register & order",
                icon: leafIcon,
              } satisfies NavLeaf,
            ]
          : []),
        {
          href: "/provider/inventory",
          label: tour ? "Gear & stock" : "Inventory",
          desc: tour ? "Kit on hand" : "Stock on hand",
          icon: leafIcon,
        },
        {
          href: "/provider/compliance",
          label: "Compliance",
          desc: "KYC & eTIMS",
          icon: leafIcon,
        },
      ],
    },
    {
      label: "Money",
      icon: financeIcon,
      children: [
        {
          href: "/provider/payouts",
          label: "Payouts",
          desc: "Settlements & next pay",
          icon: leafIcon,
        },
        {
          href: "/provider/analytics",
          label: "Insights",
          desc: tour ? "Departures snapshot" : "Revenue snapshot",
          icon: leafIcon,
        },
      ],
    },
    {
      label: "Settings",
      icon: settingsIcon,
      children: [
        {
          href: "/provider/business",
          label: "Business profile",
          desc: "Logo, phone & terms",
          icon: leafIcon,
        },
        {
          href: "/provider/businesses",
          label: "Businesses",
          desc: "Switch or add",
          icon: leafIcon,
        },
        {
          href: "/provider/profile",
          label: "Account",
          desc: "Login details",
          icon: leafIcon,
        },
      ],
    },
  ];
}

function filterItemsForRole(items: NavItem[], role: string): NavItem[] {
  const out: NavItem[] = [];
  for (const item of items) {
    if (isGroup(item)) {
      const children = item.children.filter((leaf: NavLeaf) =>
        staffCanAccessPath(role, leaf.href),
      );
      if (children.length) out.push({ ...item, children });
    } else if (staffCanAccessPath(role, item.href)) {
      out.push(item);
    }
  }
  return out;
}

export function ProviderSidebar({
  user,
  brand,
  badges,
  membershipRole = "OWNER",
  businessType = null,
  suppliersEnabled = true,
  staffingEnabled = true,
}: {
  user: { name?: string | null; email?: string | null };
  brand?: { logoUrl?: string; logoText?: string; name?: string };
  badges?: ProviderNavBadges;
  membershipRole?: string | StaffRole;
  businessType?: string | null;
  suppliersEnabled?: boolean;
  staffingEnabled?: boolean;
}) {
  const items = filterItemsForRole(
    buildItems(badges, businessType, { suppliersEnabled, staffingEnabled }),
    membershipRole,
  );
  const eyebrow = isTourOps(businessType) ? "Safari desk" : "Lodge desk";

  return (
    <DashboardNav
      eyebrow={eyebrow}
      items={items}
      user={user}
      brand={brand}
      brandHref="/provider"
      poweredBy="Powered by Safari Hub"
      topSlot={<BusinessSwitcher compact />}
    />
  );
}
