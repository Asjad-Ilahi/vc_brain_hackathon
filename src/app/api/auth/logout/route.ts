import { ok } from "@/lib/api";
import { clearSessionCookieAttrs } from "@/lib/session";

export const runtime = "nodejs";

export async function POST() {
  const res = ok({ loggedOut: true });
  res.headers.set("Set-Cookie", clearSessionCookieAttrs());
  return res;
}
