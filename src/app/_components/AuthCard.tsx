"use client";
import Link from "next/link";
import { Eyebrow } from "./ui";

export default function AuthCard({
  eyebrow,
  title,
  sub,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-5">
          <Link href="/" className="flex items-center">
            <img src="/logo.png" alt="ODIN Logo" className="w-12 h-12 rounded-xl" />
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-16 md:py-24">
        <div className="w-full max-w-md">
          <div className="u-card overflow-hidden">
            <div className="border-b border-line bg-cardalt px-6 py-5">
              <Eyebrow>{eyebrow}</Eyebrow>
              <h1 className="mt-1.5 text-[24px] font-extrabold tracking-tight">{title}</h1>
              <p className="mt-1 text-[12.5px] text-muted">{sub}</p>
            </div>
            <div className="px-6 py-6">{children}</div>
          </div>
          <p className="mt-4 text-center text-[12.5px] text-muted">{footer}</p>
        </div>
      </main>
    </div>
  );
}
