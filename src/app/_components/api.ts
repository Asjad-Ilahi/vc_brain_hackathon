export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  let j: { ok?: boolean; data?: T; error?: string };
  try {
    j = await res.json();
  } catch {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  if (!res.ok || !j.ok) throw new Error(j.error || `${res.status} ${res.statusText}`);
  return j.data as T;
}

export function fmtDuration(ms: number | null): string {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 90) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function fmtAgo(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function postJson<T>(url: string, body?: unknown): Promise<T> {
  return api<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}
