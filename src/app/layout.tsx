import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";
import AppShell from "./_components/AppShell";

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbmono", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "VC Brain — Founder Intelligence",
  description: "Decide on any deal in 24 hours — sourcing, screening, diligence, and evidence-backed memos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`h-full antialiased ${mono.variable} ${inter.variable}`}>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
