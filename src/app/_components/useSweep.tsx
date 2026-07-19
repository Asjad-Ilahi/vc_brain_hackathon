"use client";
/**
 * Client-driven founder search with a REAL progress system: each source runs
 * as its own request, so the loader shows genuine per-source state (searching →
 * found N / nothing / failed) and results stream into the page one by one as
 * each source finishes — no fake progress bars, no long blind waits.
 */
import { useCallback, useRef, useState } from "react";
import { postJson } from "./api";
import { SOURCE_OPTIONS } from "./thesisOptions";
import { Spinner } from "./ui";

export type SweepChannel = {
  id: string;
  label: string;
  state: "pending" | "searching" | "done" | "empty" | "failed";
  count: number;
};

export function useSweep(onData: () => void) {
  const [channels, setChannels] = useState<SweepChannel[]>([]);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  const setCh = (id: string, patch: Partial<SweepChannel>) =>
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const start = useCallback(
    async (enabledIds?: string[]) => {
      if (runningRef.current) return;
      const enabled = SOURCE_OPTIONS.filter((s) => !enabledIds?.length || enabledIds.includes(s.id));
      runningRef.current = true;
      setRunning(true);
      setChannels(enabled.map((s) => ({ id: s.id, label: s.label, state: "pending", count: 0 })));

      // Stream: refresh the page data every few seconds while sources work.
      const poll = setInterval(onData, 3000);
      await Promise.allSettled(
        enabled.map(async (s) => {
          setCh(s.id, { state: "searching" });
          try {
            const r = await postJson<{ created: string[] }>(`/api/source/${s.id}`);
            setCh(s.id, { state: r.created.length > 0 ? "done" : "empty", count: r.created.length });
          } catch {
            setCh(s.id, { state: "failed" });
          }
          onData(); // each finished source lands its results immediately
        })
      );
      clearInterval(poll);
      onData();
      runningRef.current = false;
      setRunning(false);
    },
    [onData]
  );

  const total = channels.reduce((n, c) => n + c.count, 0);
  return { channels, running, total, start };
}

export function SweepLoader({ channels, running, total }: { channels: SweepChannel[]; running: boolean; total: number }) {
  if (channels.length === 0) return null;
  return (
    <div className="border border-accent/40 bg-wash px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {running ? <Spinner /> : <span className="text-[12px] text-ok">✓</span>}
        <span className="text-[12px] text-accent">
          {running
            ? `Searching ${channels.length} sources — results appear below as each one finishes (${total} so far)`
            : `Search finished — ${total} matching founder${total === 1 ? "" : "s"} found`}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {channels.map((c) => (
          <span
            key={c.id}
            className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10.5px] ${
              c.state === "done"
                ? "border-ok/40 bg-okwash text-ok"
                : c.state === "searching"
                  ? "border-accent/50 bg-card text-accent"
                  : c.state === "failed"
                    ? "border-bad/40 bg-badwash text-bad"
                    : c.state === "empty"
                      ? "border-line bg-card text-faint"
                      : "border-line bg-card text-faint"
            }`}
          >
            {c.state === "searching" ? (
              <span className="h-2 w-2 animate-spin rounded-full border border-accent border-t-transparent" />
            ) : c.state === "done" ? (
              "✓"
            ) : c.state === "failed" ? (
              "✕"
            ) : c.state === "empty" ? (
              "·"
            ) : (
              "○"
            )}
            {c.label}
            {c.state === "done" ? ` ${c.count}` : ""}
            {c.state === "empty" ? " none" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
