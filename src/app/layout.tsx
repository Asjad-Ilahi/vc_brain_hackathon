import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VC Brain — Founder Intelligence",
  description: "Discover, evaluate, and decide on founders in 24 hours — with evidence.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
