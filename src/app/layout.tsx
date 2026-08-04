import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Fraunces, Outfit } from "next/font/google";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteChrome } from "@/components/site-chrome";
import { MaintenanceGate } from "@/components/maintenance-gate";
import { ReauthBanner } from "@/components/reauth-banner";
import { brandFromSettings } from "@/lib/branding";
import { getPlatformSettings } from "@/lib/settings";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const sans = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPlatformSettings();
  const name =
    String(settings["general.platformName"] || "").trim() || "Platform";
  const market = String(settings["general.marketName"] || "").trim();
  const about = String(settings["legal.about"] || "").trim();
  return {
    title: {
      default: name,
      template: `%s · ${name}`,
    },
    description:
      about ||
      (market
        ? `Book stays, dining, transport and experiences across ${market}.`
        : `Book stays, dining, transport and experiences on ${name}.`),
    applicationName: name,
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: name,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#1c1712",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const brand = await brandFromSettings();
  const h = await headers();
  const pathname = h.get("x-pathname") || "/";

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${display.variable} ${sans.variable} h-full`}
      style={
        {
          "--sun": brand.accentColor,
          "--role-brand-mark": brand.accentColor,
        } as CSSProperties
      }
    >
      <body className="min-h-full flex flex-col font-sans text-ink antialiased">
        <Providers>
          <ReauthBanner />
          <SiteChrome header={<SiteHeader />} footer={<SiteFooter />}>
            <MaintenanceGate pathname={pathname}>{children}</MaintenanceGate>
          </SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
