import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import Navbar from "@/components/Navbar";
import SetupBanner from "@/components/SetupBanner";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Popcorn — Rate movies your way",
  description: "Rank and compare movies with friends. No arbitrary stars — just real comparisons.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full text-[#f0ede8]" suppressHydrationWarning>
        <SessionProvider>
          <Navbar />
          <SetupBanner />
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
