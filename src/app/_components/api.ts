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
  return `${m}m ${s % 60}s`;
}
