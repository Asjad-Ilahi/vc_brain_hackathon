import { userFromRequest } from "@/lib/auth";
import { ok } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await userFromRequest(req);
  return ok({ user });
}
