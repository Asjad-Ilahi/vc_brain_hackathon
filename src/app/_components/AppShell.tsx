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
  { href: "/memory", label: "Memory", icon: IconDb },
  { href: "/memos", label: "Memos", icon: IconDoc },
  { href: "/diligence", label: "Diligence", icon: IconFlask },
  { href: "/activity", label: "Agent Activity Log", icon: IconTerminal },
];

// Pages that render WITHOUT the workspace chrome (sidebar/topbar). Note this is
// a different axis from proxy.ts's auth allow-list: "/onboarding" needs a
// session (auth-gated in proxy) but is chrome-less here (full-screen wizard),
// while "/" is public in proxy but chrome-less via the special-case below. Both
// lists are intentionally not identical.
const PUBLIC_PATHS = ["/signin", "/signup", "/setup", "/onboarding", "/admin", "/apply", "/invite"];

// Declared at module scope (not inside AppShell) so it isn't recreated on every
// render · a component created during render resets its subtree state each time.
function SidebarNav({ pathname, onNav }: { pathname: string; onNav?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1.5 px-3">
      {NAV.map((n) => {
        const active = pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNav}
            className={`flex items-center gap-3 rounded-full px-4 py-3 text-[14px] font-semibold transition-colors ${
              active ? "bg-white text-[#0045FF] shadow-none" : "text-white/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            <n.icon />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [user, setUser] = useState<{ name: string; email: string; role?: string } | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const isPublic = pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // The mobile drawer closes via each nav Link's onClick, the logo, and Escape
  // (below) · no route-change effect needed, which also avoids a setState-in-
  // effect cascade. Keep the Escape-to-close subscription.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (isPublic) return;
    api<{ user: { name: string; email: string; role?: string } | null }>("/api/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => {});
  }, [pathname, isPublic]);

  if (isPublic) return <>{children}</>;

  async function logout() {
    try {
      await postJson("/api/auth/logout");
    } catch {}
    router.push("/signin");
    router.refresh();
  }

  const Sidebar = (
    <div className="flex h-full flex-col bg-[#0045FF] py-6 text-white">
      <Link href="/dashboard" onClick={() => setNavOpen(false)} className="mb-8 flex items-center gap-2.5 px-6">
        <IconBrain />
        <span className="text-[19px] font-extrabold tracking-tight">VC.BRAIN</span>
      </Link>
      <SidebarNav pathname={pathname} onNav={() => setNavOpen(false)} />
      {user?.role === "admin" && (
        <div className="mt-1 px-3">
          <Link
            href="/admin/users"
            onClick={() => setNavOpen(false)}
            className={`flex items-center gap-3 rounded-full px-4 py-3 text-[14px] font-semibold transition-colors ${
              pathname.startsWith("/admin/users")
                ? "bg-white text-[#0045FF] shadow-none"
                : "text-white/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            <IconUsers />
            Team &amp; access
          </Link>
        </div>
      )}
      <div className="mt-4 px-6 text-[11px] font-medium text-white/50">v0.9 · thesis synced</div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#ffffff]">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 md:block">
        <div className="sticky top-0 h-screen p-3">
          <div className="h-full overflow-hidden rounded-[28px] border border-line shadow-none">{Sidebar}</div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {navOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setNavOpen(false)} aria-hidden />
          <div className="absolute left-0 top-0 h-full w-64 p-2">
            <div className="h-full overflow-hidden rounded-[24px] shadow-none">{Sidebar}</div>
          </div>
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex items-center gap-3 px-4 py-4 md:px-6">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F8F8F8] text-ink shadow-none border-0 md:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M2 4h12M2 8h12M2 12h12" />
            </svg>
          </button>
          <form
            className="min-w-0 flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) router.push(`/pipeline?q=${encodeURIComponent(q.trim())}`);
            }}
          >
            <div className="flex max-w-xl items-center gap-2.5 rounded-full bg-[#F8F8F8] px-5 py-3 shadow-none border-0">
              <IconSearch />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search transactions, clients, counterparties..."
                className="w-full bg-transparent text-[14px] outline-none placeholder-[#a0a0a0] text-ink"
                aria-label="Search"
              />
            </div>
          </form>
          <div className="ml-auto flex items-center gap-2.5">
            <span className="hidden items-center rounded-full bg-[#F8F8F8] px-5 py-2.5 text-[13.5px] font-semibold text-ink shadow-none border-0 sm:flex">
              {user?.name ?? "Signed in"}
            </span>
            <Link
              href="/thesis"
              aria-label="Settings"
              className="grid h-10 w-10 place-items-center rounded-full bg-[#F8F8F8] text-muted shadow-none border-0 hover:text-[#0045FF]"
            >
              <IconGear />
            </Link>
            <button
              onClick={logout}
              aria-label="Log out"
              className="grid h-10 w-10 place-items-center rounded-full bg-[#FDEAEE] text-[#E0355A] hover:bg-[#E0355A] hover:text-white transition-all shadow-none border-0 cursor-pointer"
            >
              <IconLogout />
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 pb-10 md:px-6">{children}</main>
      </div>
    </div>
  );
}

/* --------------------------------- icons --------------------------------- */
function S({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}
function IconBrain() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5a3 3 0 0 0-5.9-.7A2.6 2.6 0 0 0 4 8.3 2.6 2.6 0 0 0 5 13v.5A2.5 2.5 0 0 0 9 17a3 3 0 0 0 3 1" />
      <path d="M12 5a3 3 0 0 1 5.9-.7A2.6 2.6 0 0 1 20 8.3 2.6 2.6 0 0 1 19 13v.5A2.5 2.5 0 0 1 15 17a3 3 0 0 1-3 1" />
      <path d="M12 5v13" />
    </svg>
  );
}
function IconSearch() {
  return <span className="text-faint"><S size={17}><circle cx="9" cy="9" r="6" /><path d="m17 17-3.2-3.2" /></S></span>;
}
function IconGear() {
  return (
    <S>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M15.8 4.2l-1.4 1.4M5.6 14.4l-1.4 1.4" />
    </S>
  );
}
function IconLogout() {
  return <S><path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /><path d="M13 14l4-4-4-4M7 10h10" /></S>;
}
function IconGrid() {
  return <S><rect x="3" y="3" width="6" height="6" rx="1.5" /><rect x="11" y="3" width="6" height="6" rx="1.5" /><rect x="3" y="11" width="6" height="6" rx="1.5" /><rect x="11" y="11" width="6" height="6" rx="1.5" /></S>;
}
function IconSliders() {
  return <S><path d="M3 6h14M3 14h14" /><circle cx="8" cy="6" r="2" /><circle cx="13" cy="14" r="2" /></S>;
}
function IconRadar() {
  return <S><circle cx="10" cy="10" r="7" /><circle cx="10" cy="10" r="3" /><path d="M10 10l5-5" /></S>;
}
function IconInbox() {
  return <S><path d="M3 11h4l1.5 2.5h3L13 11h4" /><rect x="3" y="4" width="14" height="12" rx="2" /></S>;
}
function IconFlask() {
  return <S><path d="M8 3h4M9 3v4l-4 8a1.2 1.2 0 0 0 1 1.8h8a1.2 1.2 0 0 0 1-1.8l-4-8V3" /></S>;
}
function IconDoc() {
  return <S><path d="M5 3h6l4 4v10H5z" /><path d="M11 3v4h4M8 11h4M8 14h4" /></S>;
}
function IconDb() {
  return <S><ellipse cx="10" cy="5" rx="6" ry="2.4" /><path d="M4 5v10c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4V5" /><path d="M4 10c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4" /></S>;
}
function IconTerminal() {
  return <S><rect x="3" y="4" width="14" height="12" rx="2" /><path d="M6 8l2.5 2L6 12M11 12h3" /></S>;
}
function IconUsers() {
  return <S><circle cx="7" cy="7" r="2.6" /><path d="M2.5 16c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" /><path d="M13 5.2a2.6 2.6 0 0 1 0 4.6M14 12.3c1.8.4 3 1.7 3 3.7" /></S>;
}
