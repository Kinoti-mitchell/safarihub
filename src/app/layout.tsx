import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteChrome } from "@/components/site-chrome";
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
  const name = String(settings["general.platformName"] || "Safari Hub");
  const market = String(settings["general.marketName"] || "Kenya");
  const about = String(settings["legal.about"] || "").trim();
  return {
    title: {
      default: name,
      template: `%s · ${name}`,
    },
    description:
      about ||
      `Book stays, safari tours, dining and travel experiences across ${market}.`,
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${display.variable} ${sans.variable} h-full`}
    >
      <body className="min-h-full flex flex-col font-sans text-ink antialiased">
        <Providers>
          <SiteChrome header={<SiteHeader />} footer={<SiteFooter />}>
            {children}
          </SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
