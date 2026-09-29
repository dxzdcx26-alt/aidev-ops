import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ensureDefaultAdmin } from "@/lib/auth";
import { ensureDatabase } from "@/lib/db";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aidev Ops · AI Dev V4",
  description: "AI Dev V4 control plane — GitHub, AI review, security, CI/CD, deploy, audit",
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
};

// Boot-time initialization: ensure default admin user exists
let adminInitialized = false;
async function initAdmin() {
  if (adminInitialized) return;
  adminInitialized = true;
  try {
    await ensureDatabase();
    await ensureDefaultAdmin();
  } catch (err) {
    // Don't crash the app — just log
    console.error("[boot] Failed to ensure default admin:", err instanceof Error ? err.message : String(err));
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Run admin initialization in parallel — don't block render
  initAdmin().catch(() => {});

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
