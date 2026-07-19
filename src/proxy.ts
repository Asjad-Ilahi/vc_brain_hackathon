/**
 * Auth gate. Workspace pages redirect to /signin; API routes return 401 JSON.
 * Public: the landing page, sign-in/up, the founder apply portal + its 24h
 * outcome page, auth APIs, static assets, and the Vercel cron's scheduled sweep.
 */
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// Pages reachable with NO session. Founders have no account (the apply portal +
// its status page + the outreach "?ref=" converge link). "/setup" is the
// first-run admin bootstrap; "/invite/*" (below) is how an invited operator sets
// their password before an account exists.
const PUBLIC_PAGES = new Set(["/", "/admin", "/signin", "/signup", "/setup", "/apply", "/apply/status"]);

function isPublic(req: NextRequest): boolean {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PAGES.has(pathname)) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname === "/api/apply" && req.method === "POST") return true;
  // Founder checks their own 24h outcome by opaque publicRef — no session.
  if (pathname === "/api/apply/status" && req.method === "GET") return true;
  // First-run bootstrap: no user exists yet, so /api/setup has no session.
  if (pathname === "/api/setup") return true;
  // Invited operator accepts + sets a password before their account exists.
  if (pathname.startsWith("/invite/")) return true;
  if (pathname === "/api/invites/accept") return true; // GET (lookup) + POST (accept), pre-account
  // Vercel cron fires GET /api/source/all on a schedule (no session). With
  // CRON_SECRET set, Vercel sends it as a Bearer token — require it, since a
  // user-agent alone is spoofable (and this endpoint spends API credits).
  if (pathname === "/api/source/all" && req.method === "GET") {
    const secret = process.env.CRON_SECRET;
    if (secret) return req.headers.get("authorization") === `Bearer ${secret}`;
    return (req.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  }
  return false;
}

export default async function proxy(req: NextRequest) {
  if (isPublic(req)) return NextResponse.next();

  const uid = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (uid) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }
  const adminUrl = req.nextUrl.clone();
  adminUrl.pathname = "/admin";
  adminUrl.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(adminUrl);
}

export const config = {
  // Everything except Next internals and static files (anything with a dot).
  matcher: ["/((?!_next/|.*\\..*).*)"],
};
