"use client";
/**
 * The living profile · "a credit score for founders". The persistent score with
 * its full trajectory, every venture the person has surfaced with, and every
 * timestamped signal Memory holds on them. Follows the person, never the company.
 */
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api, fmtAgo } from "../../_components/api";
import { Badge, Eyebrow, Spinner, scoreTone } from "../../_components/ui";
import { CHANNEL_SIGNAL, initialsOf } from "../../_components/shared";

type Founder = {
  id: string;
  fullName: string;
  canonicalHandle: string;
  githubLogin: string | null;
  location: string | null;
  bio: string | null;
  founderScore: number;
  founderScoreConfidence: number;
  isColdStart: boolean;
  firstSeenAt: string;
  email: string | null;
};
type HistoryRow = { id: string; score: number; delta: number; reason: string; milestone: string | null; createdAt: string };
type Venture = {
  opportunityId: string;
  company: string;
  oneLiner: string | null;
  sector: string | null;
  source: string;
  sourceChannel: string | null;
  status: string;
  decision: string | null;
  convictionScore: number | null;
  createdAt: string;
};
type SignalRow = { id: string; sourceType: string; sourceUrl: string | null; title: string | null; rawText: string | null; ingestedAt: string };
type Profile = { founder: Founder; history: HistoryRow[]; ventures: Venture[]; signals: SignalRow[] };

export default function FounderProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [p, setP] = useState<Profile | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Profile>(`/api/founders/${id}`)
      .then(setP)
      .catch((e) => setErr((e as Error).message));
  }, [id]);

  if (err)
    return (
      <div className="py-16">
        <p className="text-[13px] text-bad">{err}</p>
        <Link href="/memory" className="text-[12px] text-[#0045FF] font-bold hover:underline">← Memory</Link>
      </div>
    );
  if (!p)
    return (
      <div className="py-24 text-center">
        <Spinner label="Loading profile…" />
      </div>
    );

  const { founder: f, history, ventures, signals } = p;
  const maxScore = Math.max(100, ...history.map((h) => h.score));
  const chrono = [...history].reverse(); // oldest → newest for the trajectory

  return (
    <div>
      <div className="mb-5">
        <Link href="/memory" className="text-[12px] text-[#0045FF] font-bold hover:underline">← Founder database</Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-[#eceef3] bg-[#F8F8F8] text-[#0045FF] text-[18px] font-bold">
              {initialsOf(f.fullName)}
            </span>
            <div className="min-w-0">
              <Eyebrow>Living profile · persists across ventures · never resets</Eyebrow>
              <h1 className="mt-1 text-[24px] font-bold tracking-tight text-ink">{f.fullName}</h1>
              <p className="mt-0.5 text-[12px] text-muted">
                @{f.canonicalHandle}
                {f.location ? ` · ${f.location}` : ""} · first seen {fmtAgo(f.firstSeenAt)}
              </p>
              {f.bio ? <p className="mt-2 max-w-xl text-[13px] text-muted">{f.bio}</p> : null}
              <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                {f.isColdStart ? <Badge tone="warn">cold-start</Badge> : null}
                {f.githubLogin ? (
                  <a href={`https://github.com/${f.githubLogin}`} target="_blank" rel="noreferrer">
                    <Badge>github ↗</Badge>
                  </a>
                ) : null}
                {f.email ? (
                  <a href={`mailto:${f.email}`}>
                    <Badge tone="accent">✉️ {f.email}</Badge>
                  </a>
                ) : (
                  <Badge tone="neutral">✉️ Extracting contact email...</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="bg-[#F8F8F8] rounded-[24px] border-0 p-6 shadow-none text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#9E9E9E] font-sans">Founder score</div>
            <div className={`tnum mt-1 text-[40px] font-bold leading-none ${scoreTone(f.founderScore)}`}>
              ★ {f.founderScore}
            </div>
            <div className="mt-1 text-[10.5px] text-faint">
              confidence {Math.round(f.founderScoreConfidence * 100)}%
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 px-6 py-6 md:px-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          {/* Score trajectory */}
          <section className="bg-[#F8F8F8] rounded-[28px] p-6 border-0 shadow-none">
            <div className="border-b border-[#eceef3] pb-3 mb-3 text-[10px] font-bold uppercase tracking-wider text-[#9E9E9E] font-sans">
              Score trajectory · every milestone appended, nothing discarded
            </div>
            {chrono.length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-faint">No score history yet.</p>
            ) : (
              <div>
                {/* mini bar chart */}
                <div className="flex h-24 items-end gap-1.5 px-2">
                  {chrono.map((h) => (
                    <div key={h.id} className="group relative flex-1" title={`${h.score} · ${h.reason}`}>
                      <div
                        className={`w-full rounded-t-sm ${h.delta > 0 ? "bg-[#12A150]" : h.delta < 0 ? "bg-[#E0355A]" : "bg-[#eceef3]"}`}
                        style={{ height: `${Math.max(8, (h.score / maxScore) * 96)}px` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-1.5 border-t border-[#eceef3] pt-4">
                  {history.map((h) => (
                    <div key={h.id} className="flex items-baseline gap-2.5 text-[11.5px] font-sans">
                      <span className="tnum shrink-0 text-faint">{fmtAgo(h.createdAt)}</span>
                      <span className={`tnum shrink-0 ${h.delta > 0 ? "text-ok" : h.delta < 0 ? "text-bad" : "text-faint"}`}>
                        {h.delta >= 0 ? "+" : ""}
                        {h.delta}
                      </span>
                      <span className="tnum shrink-0 font-bold text-ink">{h.score}</span>
                      <span className="min-w-0 truncate text-muted">{h.reason}</span>
                      {h.milestone ? <Badge>{h.milestone}</Badge> : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Ventures */}
          <section className="mt-6">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#9E9E9E] font-sans pl-2">
              Ventures · the score follows the person across all of them
            </div>
            <div className="bg-[#F8F8F8] rounded-[28px] p-6 border-0 shadow-none space-y-3">
              {ventures.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[#eceef3] py-8 text-center text-[12.5px] text-faint bg-white">
                  No ventures linked yet.
                </p>
              ) : (
                ventures.map((v) => (
                  <Link
                    key={v.opportunityId}
                    href={`/opportunity/${v.opportunityId}`}
                    className="group flex flex-wrap items-center justify-between gap-3 bg-white rounded-full px-8 py-3.5 border border-[#eceef3] shadow-none hover:bg-slate-50 transition-all"
                  >
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[13.5px] font-bold text-ink group-hover:text-[#0045FF]">{v.company}</span>
                        {v.sector ? <Badge>{v.sector}</Badge> : null}
                        <Badge tone={v.source === "outbound" ? "accent" : "neutral"}>
                          {CHANNEL_SIGNAL[v.sourceChannel ?? ""] ?? v.source}
                        </Badge>
                      </div>
                      {v.oneLiner ? <p className="mt-0.5 truncate text-[12px] text-muted font-sans font-medium">{v.oneLiner}</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {v.decision ? (
                        <Badge tone={v.decision === "invest" ? "ok" : v.decision === "watch" ? "warn" : "bad"}>
                          {v.decision === "invest" ? "✓ deployed" : v.decision}
                        </Badge>
                      ) : (
                        <Badge tone="accent">{v.status.replace("_", " ")}</Badge>
                      )}
                      <span className="text-faint group-hover:text-[#0045FF]">→</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Signals rail */}
        <aside>
          {/* Sourcing & Contact Details */}
          <div className="bg-[#F8F8F8] rounded-[28px] p-6 border-0 shadow-none mb-6">
            <div className="border-b border-[#eceef3] pb-3 mb-4 text-[10px] font-bold uppercase tracking-wider text-[#9E9E9E] font-sans">
              Diligence Profile Details
            </div>
            <div className="space-y-3.5 text-[12.5px] font-sans text-muted">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink">Contact Email:</span>
                {f.email ? (
                  <a href={`mailto:${f.email}`} className="text-[#0045FF] font-bold hover:underline">
                    {f.email}
                  </a>
                ) : (
                  <span className="text-faint italic">Searching public sources...</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink">Github Username:</span>
                {f.githubLogin ? (
                  <a
                    href={`https://github.com/${f.githubLogin}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#0045FF] font-bold hover:underline"
                  >
                    @{f.githubLogin}
                  </a>
                ) : (
                  <span className="text-faint">Not linked</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink">Total Ventures:</span>
                <span className="font-bold text-ink">{ventures.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink">Primary Location:</span>
                <span className="text-ink font-medium">{f.location ?? "Global / Remote"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink">First Spotted:</span>
                <span className="text-ink font-medium">{new Date(f.firstSeenAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#F8F8F8] rounded-[28px] p-6 border-0 shadow-none">
            <div className="border-b border-[#eceef3] pb-3 mb-3 text-[10px] font-bold uppercase tracking-wider text-[#9E9E9E] font-sans">
              Memory · latest signals ({signals.length})
            </div>
            <div className="max-h-[560px] space-y-3 overflow-y-auto">
              {signals.length === 0 ? (
                <p className="py-4 text-center text-[12.5px] text-faint">No signals recorded.</p>
              ) : (
                signals.map((sg) => (
                  <div key={sg.id} className="border-b border-[#eceef3] pb-3 last:border-b-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge>{sg.sourceType}</Badge>
                      <span className="text-[10.5px] text-faint">{fmtAgo(sg.ingestedAt)}</span>
                      {sg.sourceUrl ? (
                        <a href={sg.sourceUrl} target="_blank" rel="noreferrer" className="text-[10.5px] text-[#0045FF] font-semibold hover:underline">
                          Source ↗
                        </a>
                      ) : null}
                    </div>
                    {sg.title ? <div className="mt-1 text-[11.5px] font-bold text-ink">{sg.title}</div> : null}
                    <p className="mt-0.5 line-clamp-3 text-[11.5px] leading-snug text-muted font-sans">{sg.rawText}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
