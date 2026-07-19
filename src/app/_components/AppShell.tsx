"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, postJson } from "./api";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: IconGrid },
  { href: "/thesis", label: "Thesis", icon: IconSliders },
  { href: "/radar", label: "Radar", icon: IconRadar },
  { href: "/pipeline", label: "Pipeline", icon: IconInbox },
  { href: "/diligence", label: "Diligence", icon: IconFlask },
  { href: "/memos", label: "Memos", icon: IconDoc },
  { href: "/memory", label: "Founders", icon: IconDb },
];

// Pages that render without the workspace chrome.
const PUBLIC_PATHS = ["/signin", "/signup", "/onboarding"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const isPublic = pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Close overlays on route change and on Escape.
  useEffect(() => {
    setMenuOpen(false);
    setNavOpen(false);
  }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setNavOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (isPublic) return;
    api<{ user: { name: string; email: string } | null }>("/api/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => {});
  }, [pathname, isPublic]);

  // Landing, auth, and onboarding run full-bleed with their own headers.
  if (isPublic) return <>{children}</>;

  const initials = user
    ? (user.name.trim().split(/\s+/)[0]?.[0] ?? "") + (user.name.trim().split(/\s+/)[1]?.[0] ?? "")
    : "··";

  async function logout() {
    try {
      await postJson("/api/auth/logout");
    } catch {}
    router.push("/signin");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="flex h-14 items-center gap-3 border-b border-line bg-card px-4 md:gap-4">
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation"
          className="grid h-8 w-8 shrink-0 place-items-center border border-line bg-paper text-ink md:hidden"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M2 4h12M2 8h12M2 12h12" />
          </svg>
        </button>
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center bg-accent text-accentink">
            <IconBolt />
          </span>
          <span className="font-mono text-sm font-bold tracking-wide">VC.BRAIN</span>
        </Link>
        <form
          className="min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) router.push(`/pipeline?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <div className="flex max-w-2xl items-center gap-2 border border-line bg-paper px-3 py-1.5">
            <span className="text-faint">⌕</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search founders, companies, memos…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
              aria-label="Search"
            />
          </div>
        </form>
        <span className="hidden items-center gap-1.5 border border-line bg-paper px-2.5 py-1 font-mono text-[11px] text-muted sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" /> Live
        </span>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Account menu"
            aria-expanded={menuOpen}
            className="grid h-8 w-8 place-items-center border border-line bg-paper font-mono text-[11px] font-bold uppercase hover:border-linestrong"
          >
            {initials || "··"}
          </button>
          {menuOpen ? (
            <>
              {/* click-away backdrop */}
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden />
              <div className="absolute right-0 top-10 z-50 w-56 border border-linestrong bg-card shadow-lg">
                <div className="border-b border-line px-3.5 py-2.5">
                  <div className="truncate font-mono text-[12.5px] font-semibold">{user?.name ?? "Signed in"}</div>
                  <div className="truncate text-[11px] text-muted">{user?.email ?? ""}</div>
                </div>
                <button
                  onClick={logout}
                  className="w-full px-3.5 py-2.5 text-left font-mono text-[12px] text-bad hover:bg-badwash"
                >
                  ← Log out
                </button>
              </div>
            </>
          ) : null}
        </div>
      </header>

      {/* Mobile nav drawer */}
      {navOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setNavOpen(false)} aria-hidden />
          <nav className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-linestrong bg-card">
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <span className="font-mono text-[13px] font-bold tracking-wide">VC.BRAIN</span>
              <button onClick={() => setNavOpen(false)} aria-label="Close navigation" className="text-muted hover:text-ink">
                ✕
              </button>
            </div>
            <div className="px-4 pb-1 pt-4 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted">Workspace</div>
            <div className="flex flex-col gap-0.5 px-2">
              {NAV.map((n) => {
                const active = pathname.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`flex items-center gap-2.5 px-2.5 py-2.5 font-mono text-[13.5px] ${
                      active ? "bg-wash text-accent" : "text-muted"
                    }`}
                  >
                    <n.icon />
                    {n.label}
                  </Link>
                );
              })}
            </div>
            <button onClick={logout} className="mt-auto border-t border-line px-4 py-3.5 text-left font-mono text-[12.5px] text-bad">
              ← Log out
            </button>
          </nav>
        </div>
      ) : null}

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="hidden w-52 shrink-0 flex-col border-r border-line bg-card md:flex">
          <div className="px-4 pb-1 pt-5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
            Workspace
          </div>
          <nav className="flex flex-col gap-0.5 px-2 py-1">
            {NAV.map((n) => {
              const active = pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex items-center gap-2.5 px-2.5 py-2 font-mono text-[13px] transition-colors ${
                    active ? "bg-wash text-accent" : "text-muted hover:bg-paper hover:text-ink"
                  }`}
                >
                  <n.icon />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto flex items-center gap-2 border-t border-line px-4 py-3 font-mono text-[11px] text-faint">
            v0.9 · thesis synced <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

/* ----------------------------- tiny line icons ----------------------------- */
function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      {children}
    </svg>
  );
}
function IconBolt() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M9 1 3 9h4l-1 6 6-8H8l1-6z" />
    </svg>
  );
}
function IconGrid() {
  return (
    <Svg>
      <rect x="2" y="2" width="5" height="5" /><rect x="9" y="2" width="5" height="5" />
      <rect x="2" y="9" width="5" height="5" /><rect x="9" y="9" width="5" height="5" />
    </Svg>
  );
}
function IconSliders() {
  return (
    <Svg>
      <path d="M2 4h12M2 8h12M2 12h12" /><circle cx="6" cy="4" r="1.6" fill="var(--color-card)" />
      <circle cx="11" cy="8" r="1.6" fill="var(--color-card)" /><circle cx="5" cy="12" r="1.6" fill="var(--color-card)" />
    </Svg>
  );
}
function IconRadar() {
  return (
    <Svg>
      <circle cx="8" cy="8" r="6" /><circle cx="8" cy="8" r="2.8" /><path d="M8 8l4.2-4.2" />
    </Svg>
  );
}
function IconInbox() {
  return (
    <Svg>
      <path d="M2 9h3.5l1 2h3l1-2H14" /><rect x="2" y="3" width="12" height="10" />
    </Svg>
  );
}
function IconFlask() {
  return (
    <Svg>
      <path d="M6 2h4M7 2v4l-4 7a1 1 0 0 0 .9 1.5h8.2A1 1 0 0 0 13 13L9 6V2" />
    </Svg>
  );
}
function IconDoc() {
  return (
    <Svg>
      <path d="M4 2h6l3 3v9H4z" /><path d="M10 2v3h3M6.5 8h4M6.5 11h4" />
    </Svg>
  );
}
function IconDb() {
  return (
    <Svg>
      <ellipse cx="8" cy="3.5" rx="5.5" ry="2" /><path d="M2.5 3.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9" />
      <path d="M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2" />
    </Svg>
  );
}
