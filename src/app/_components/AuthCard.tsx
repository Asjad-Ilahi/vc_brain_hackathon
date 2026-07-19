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
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center bg-accent text-accentink">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M9 1 3 9h4l-1 6 6-8H8l1-6z" />
              </svg>
            </span>
            <span className="font-mono text-sm font-bold tracking-wide">VC.BRAIN</span>
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-16 md:py-24">
        <div className="w-full max-w-md">
          <div className="border border-line bg-card">
            <div className="border-b border-line bg-paper px-6 py-5">
              <Eyebrow>{eyebrow}</Eyebrow>
              <h1 className="mt-1.5 font-mono text-[22px] font-bold tracking-tight">{title}</h1>
              <p className="mt-1 text-[12.5px] text-muted">{sub}</p>
            </div>
            <div className="px-6 py-6">{children}</div>
          </div>
          <p className="mt-4 text-center font-mono text-[12px] text-muted">{footer}</p>
        </div>
      </main>
    </div>
  );
}
