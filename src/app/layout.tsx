import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { HeaderAccount } from "@/components/HeaderAccount";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rhett · BU student assistant",
  description: "Plan registration, your week and your food spending at Boston University.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Rhett", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#cc0000", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} font-sans antialiased`}>
        <header className="sticky top-0 z-20 bg-bu text-white">
          <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-sm font-black text-bu">R</span>
              <span className="text-lg font-bold">Rhett</span>
            </Link>
            <HeaderAccount />
          </div>
        </header>
        <main className="mx-auto max-w-md px-4 pt-4 pb-28">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
