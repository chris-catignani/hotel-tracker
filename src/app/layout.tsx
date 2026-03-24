import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { MobileHeader } from "@/components/mobile-header";
import { SessionProvider } from "next-auth/react";
import { SentryUserContext } from "@/components/sentry-user-context";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hotel Tracker",
  description: "Track hotel bookings and their true net cost",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full overflow-hidden`}
      >
        <SessionProvider>
          <SentryUserContext />
          <Toaster richColors position="top-right" />
          <div className="flex flex-col lg:flex-row h-dvh bg-background overflow-hidden">
            <MobileHeader />
            <Sidebar />
            <main className="flex-1 overflow-y-auto min-h-0">
              <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 h-full flex flex-col">
                {children}
              </div>
            </main>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
