"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, fmtAgo } from "../_components/api";
import { Badge, Chip, Spinner, scoreTone } from "../_components/ui";
import { PageHeader, initialsOf } from "../_components/shared";

type FounderCard = {
  id: string;
  name: string;
  handle: string;
  location: string | null;
  bio: string | null;
  score: number;
  confidence: number;
  isColdStart: boolean;
  status: "deployed" | "in_pipeline" | "tracking" | "passed";
  sectors: string[];
  sources: string[];
  lastSignalAt: string | null;
  lastDelta: number;
  firstSeenAt: string;
  latestOpportunityId: string | null;
};

const STATUS_LABEL: Record<FounderCard["status"], string> = {
  in_pipeline: "In pipeline",
  deployed: "Deployed",
  tracking: "Tracking",
  passed: "Passed",
};
const STATUS_TONE: Record<FounderCard["status"], "accent" | "ok" | "warn" | "neutral"> = {
  in_pipeline: "accent",
  deployed: "ok",
  tracking: "warn",
  passed: "neutral",
};

export default function MemoryPage() {
  const [founders, setFounders] = useState<FounderCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | FounderCard["status"]>("all");

  useEffect(() => {
    api<FounderCard[]>("/api/founders")
      .then(setFounders)
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return founders.filter((f) => {
      if (status !== "all" && f.status !== status) return false;
      if (!needle) return true;
      return [f.name, f.handle, f.location, ...f.sectors, f.bio]
        .filter(Boolean)
        .some((s) => (s as string).toLowerCase().includes(needle));
    });
  }, [founders, q, status]);

  const count = (s: FounderCard["status"]) => founders.filter((f) => f.status === s).length;

  return (
    <div>
      <PageHeader
        eyebrow="Module 04 · Memory"
        title="Founder database."
        sub="Every founder we have ever seen — with a score that follows the person across companies. Nothing is deleted, nothing resets."
      />

      <div className="px-6 py-5 md:px-8">
        <div className="flex max-w-xl items-center gap-2 border border-line bg-card px-3 py-2">
          <span className="text-faint">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, handle, sector, city…"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-faint"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip active={status === "all"} onClick={() => setStatus("all")}>All · {founders.length}</Chip>
          {(["in_pipeline", "deployed", "tracking", "passed"] as const).map((s) => (
            <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
              {STATUS_LABEL[s]} · {count(s)}
            </Chip>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center"><Spinner label="Loading founder database…" /></div>
        ) : shown.length === 0 ? (
          <div className="mt-5 border border-dashed border-linestrong py-16 text-center text-[13px] text-faint">
            No founders match.
          </div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((f) => (
              <div key={f.id} className="flex flex-col border border-line bg-card">
                <div className="flex items-start gap-3 p-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center border border-line bg-paper font-mono text-[12px] font-bold">
                    {f.isColdStart && f.name.toLowerCase().includes("anon") ? "??" : initialsOf(f.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-mono text-[13.5px] font-semibold">{f.name}</span>
                      <span className={`tnum shrink-0 font-mono text-[17px] font-bold ${scoreTone(f.score)}`}>
                        ★ {f.score}
                      </span>
                    </div>
                    <div className="truncate text-[11.5px] text-faint">
                      @{f.handle}
                      {f.location ? ` · ${f.location}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1 px-3.5 pb-3">
                  {f.sectors.slice(0, 2).map((s) => (
                    <Badge key={s}>{s}</Badge>
                  ))}
                  {f.sources.slice(0, 2).map((s) => (
                    <Badge key={s} tone="neutral">▸ {s}</Badge>
                  ))}
                  {f.isColdStart ? <Badge tone="warn">new founder</Badge> : null}
                  <Badge tone={STATUS_TONE[f.status]}>{STATUS_LABEL[f.status]}</Badge>
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-line px-3.5 py-2">
                  <span className="font-mono text-[10.5px] text-faint">
                    Last signal · {fmtAgo(f.lastSignalAt)}
                    {f.lastDelta !== 0 ? (
                      <span className={f.lastDelta > 0 ? "text-ok" : "text-bad"}>
                        {" "}
                        · {f.lastDelta > 0 ? "+" : ""}
                        {f.lastDelta}
                      </span>
                    ) : null}
                  </span>
                  <Link
                    href={`/founder/${f.id}`}
                    className="font-mono text-[10.5px] uppercase tracking-wide text-accent hover:underline"
                  >
                    Open profile →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
