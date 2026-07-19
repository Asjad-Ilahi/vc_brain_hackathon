/**
 * Session tokens — HMAC-SHA256-signed, edge-safe (Web Crypto only, no node:crypto)
 * so the SAME implementation runs in middleware (edge) and API routes (node).
 * Token: base64url(payload JSON) + "." + base64url(HMAC signature).
 */

export const SESSION_COOKIE = "vcb_session";
const WEEK_S = 7 * 24 * 3600;

type SessionPayload = { uid: string; exp: number };

function secretString(): string {
  // Prefer an explicit AUTH_SECRET; fall back to a value derived from the DB
  // URL so the app works without extra env setup (hackathon pragmatism).
  return process.env.AUTH_SECRET || `vcb-auth::${process.env.DATABASE_URL ?? "dev-secret"}`;
}

async function hmacKey(): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(secretString());
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function createSessionToken(userId: string): Promise<string> {
  const payload: SessionPayload = { uid: userId, exp: Math.floor(Date.now() / 1000) + WEEK_S };
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey();
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return `${body}.${b64url(sig)}`;
}

/** Returns the user id if the token is valid and unexpired, else null. */
export async function verifySessionToken(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const key = await hmacKey();
    const ok = await crypto.subtle.verify("HMAC", key, b64urlDecode(sig) as BufferSource, new TextEncoder().encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as SessionPayload;
    if (!payload.uid || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

export function sessionCookieAttrs(token: string, maxAgeS = WEEK_S): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeS}${secure}`;
}

export function clearSessionCookieAttrs(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function tokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return m ? m[1] : null;
}
