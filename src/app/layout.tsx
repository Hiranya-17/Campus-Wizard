import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { HeaderAccount } from "@/components/HeaderAccount";
import { WorkspaceTour } from "@/components/WorkspaceTour";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CampusWizard · Your semester, thoughtfully organized",
  description: "Plan registration, your week, getting to class, exams, food and money at Boston University.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "CampusWizard", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#f7f7f5", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center px-4 py-2.5">
            <HeaderAccount />
          </div>
        </header>
        <main className="mx-auto max-w-md px-4 pt-6 pb-28">{children}</main>
        <BottomNav />
        <WorkspaceTour />
      </body>
    </html>
  );
}
