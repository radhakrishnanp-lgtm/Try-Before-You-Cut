import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { Spotlight } from "@/components/fx/Spotlight";
import { ServiceWorker } from "@/components/ServiceWorker";
import { config } from "@/lib/config";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", style: ["normal", "italic"], axes: ["opsz", "SOFT"] });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

// Rendered per request so runtime settings from .env (domain, contact email) apply.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(config.appUrl),
  title: { default: "Try-Before-You-Cut · See the cut before the scissors", template: "%s · Try-Before-You-Cut" },
  description: "Salon-branded AI hairstyle consultations. Customers see realistic previews on their own face before the stylist cuts.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Try-Before-You-Cut", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0c0b0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${fraunces.variable} ${manrope.variable}`}>
      <body>
        {children}
        <Spotlight />
        <ServiceWorker />
      </body>
    </html>
  );
}
