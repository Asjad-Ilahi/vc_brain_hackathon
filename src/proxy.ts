/**
 * Auth gate. Workspace pages redirect to /signin; API routes return 401 JSON.
 * Public: the landing page, sign-in/up, auth APIs, static assets, and the
 * Vercel cron's scheduled sweep.
 */
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const PUBLIC_PAGES = new Set(["/", "/signin", "/signup"]);

function isPublic(req: NextRequest): boolean {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PAGES.has(pathname)) return true;
  if (pathname.startsWith("/api/auth/")) return true;
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
  const signin = req.nextUrl.clone();
  signin.pathname = "/signin";
  signin.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(signin);
}

export const config = {
  // Everything except Next internals and static files (anything with a dot).
  matcher: ["/((?!_next/|.*\\..*).*)"],
};
