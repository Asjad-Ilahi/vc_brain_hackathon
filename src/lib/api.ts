import { NextResponse } from "next/server";

export function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
