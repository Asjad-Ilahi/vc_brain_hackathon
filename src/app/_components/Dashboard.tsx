"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OpportunitySummary } from "@/lib/services/list";
import type { Thesis, ThesisProfile } from "@/lib/services/thesis";
import { api, postJson, fmtDuration } from "./api";
import { Badge, Countdown, Eyebrow, ScorePill, Spinner, Stat, TraceLine, TrendArrow, countdownParts, useNow } from "./ui";
import { ApplyModal, GhostButton, PrimaryButton, initialsOf } from "./shared";
import { SweepLoader, useSweep } from "./useSweep";

type Activity = { id: string; agent: string; outputSummary: string | null; createdAt: string; opportunityId: string; company: string };
type ChannelStat = { name: string; found: number; quality: number };
type AutoStatus = { ready: number; working: number; queued: number; decided: number; screenedOut: number };
type GraphNode = {
  id: string;
  institutionName: string;
  programName: string;
  qualityRating: number;
  companyName: string;
  founderName: string;
  opportunityId: string;
};
type ChannelIntel = {
  channels: ChannelStat[];
  suggestions: { channel: string; why: string }[];
  graphNodes: GraphNode[];
};

const AUTOPILOT_CONCURRENCY = 2; // parallel background workers
const AUTOPILOT_DEFAULT_TARGET = 10; // fully-checked deals before pausing

export default function Dashboard() {
  const router = useRouter();
  const now = useNow(30_000);
  const [opps, setOpps] = useState<OpportunitySummary[]>([]);
  const [thesis, setThesis] = useState<Thesis | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [channels, setChannels] = useState<ChannelStat[]>([]);
  const [suggestions, setSuggestions] = useState<{ channel: string; why: string }[]>([]);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [founderCount, setFounderCount] = useState<{ total: number; week: number } | null>(null);
  const [account, setAccount] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showApply, setShowApply] = useState(false);

  const load = useCallback(async () => {
    try {
      const [o, t, a, c, f] = await Promise.all([
        api<OpportunitySummary[]>("/api/opportunities"),
        api<{ active: Thesis | null }>("/api/thesis"),
        api<Activity[]>("/api/activity").catch(() => []),
        api<ChannelIntel>("/api/channels").catch(() => ({ channels: [], suggestions: [], graphNodes: [] })),
        api<{ firstSeenAt: string }[]>("/api/founders").catch(() => []),
      ]);
      setOpps(o);
      setThesis(t.active);
      setActivity(a);
      setChannels(c.channels);
      setSuggestions(c.suggestions || []);
      setGraphNodes(c.graphNodes || []);
      api<{ user: { name: string } | null }>("/api/auth/me")
        .then((r) => setAccount(r.user))
        .catch(() => { });
      const week = f.filter((x) => Date.now() - new Date(x.firstSeenAt).getTime() < 7 * 86_400_000).length;
      setFounderCount({ total: f.length, week });
    } catch (e) {
      setStatus(`Load failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ---------------------------------------------------------------------
  // Autopilot: after the profile is saved, background agents take each find
  // through the FULL check — background check, screening, 3-way scoring,
  // memo, verification — in parallel, until `target` deals are finished.
  // The investor sees results, not buttons.
  // ---------------------------------------------------------------------
  const [auto, setAuto] = useState<AutoStatus | null>(null);
  const [target, setTarget] = useState<number>(AUTOPILOT_DEFAULT_TARGET);
  const inFlight = useRef(0);

  useEffect(() => {
    try {
      const t = Number(localStorage.getItem("vcb.autopilot.target"));
      if (t > 0) setTarget(t);
    } catch { }
  }, []);

  const refreshAuto = useCallback(async () => {
    try {
      setAuto(await api<AutoStatus>("/api/autopilot/status"));
    } catch { }
  }, []);

  useEffect(() => {
    refreshAuto();
    const t = setInterval(refreshAuto, 5000);
    return () => clearInterval(t);
  }, [refreshAuto]);

  // Worker pump: keep up to N parallel background checks running until the
  // target is met or the queue is empty.
  useEffect(() => {
    const tick = setInterval(() => {
      if (!auto) return;
      const finished = auto.ready + auto.decided;
      if (finished >= target) return;
      if (inFlight.current >= AUTOPILOT_CONCURRENCY) return;
      inFlight.current += 1;
      postJson<{ processed: string | null }>("/api/autopilot/next")
        .catch(() => null)
        .finally(() => {
          inFlight.current -= 1;
          refreshAuto();
          load();
        });
    }, 4000);
    return () => clearInterval(tick);
  }, [auto, target, refreshAuto, load]);

  function processMore() {
    const next = (auto ? auto.ready + auto.decided : 0) + AUTOPILOT_DEFAULT_TARGET;
    setTarget(next);
    try {
      localStorage.setItem("vcb.autopilot.target", String(next));
    } catch { }
  }

  // Live founder search with per-source progress; results stream in as each
  // source finishes.
  const sweep = useSweep(load);

  function scoutAll() {
    setStatus(null);
    sweep.start(((thesis?.profileJson ?? null) as ThesisProfile | null)?.enabledSources);
  }

  // Onboarding hands off here: the wizard sets a flag, the dashboard runs the
  // first search visibly so the investor watches results arrive one by one.
  useEffect(() => {
    if (!thesis) return;
    try {
      if (localStorage.getItem("vcb.sweep.request") === "1") {
        localStorage.removeItem("vcb.sweep.request");
        sweep.start(((thesis.profileJson ?? null) as ThesisProfile | null)?.enabledSources);
      }
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thesis]);

  const profile = (thesis?.profileJson ?? null) as ThesisProfile | null;
  const threshold = thesis?.convictionThreshold ?? 68;

  const undecided = opps.filter((o) => !o.decision);
  const awaiting = opps.filter((o) => o.status === "awaiting_decision" && !o.decision);
  const urgent = undecided.filter((o) => {
    const p = countdownParts(o.deadlineAt, now);
    return p && !p.expired && p.urgent;
  });
  const overdue = undecided.filter((o) => {
    const p = countdownParts(o.deadlineAt, now);
    return p?.expired;
  });
  const crossed = opps
    .filter((o) => o.source === "outbound" && !o.decision && o.status !== "awaiting_decision" && (o.convictionScore ?? 0) >= threshold)
    .sort((a, b) => (b.convictionScore ?? 0) - (a.convictionScore ?? 0));
  const crossed24h = crossed.filter((o) => now - new Date(o.firstSignalAt).getTime() < 24 * 3600_000);
  const signals24h = opps.filter((o) => now - new Date(o.firstSignalAt).getTime() < 24 * 3600_000).length;
  const decided = opps.filter((o) => o.timeToDecisionMs != null);
  const avgTtd = decided.length ? decided.reduce((s, o) => s + (o.timeToDecisionMs ?? 0), 0) / decided.length : null;

  const hour = new Date(now).getHours();
  const daypart = hour < 5 ? "night" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const firstName = (profile?.gpName ?? account?.name)?.split(/\s+/)[0];
  const calibratedDays = thesis
    ? Math.max(0, Math.floor((now - new Date(thesis.createdAt).getTime()) / 86_400_000))
    : null;

  const channelBits = channels
    .slice(0, 3)
    .map((c) => `${c.name} ${c.found}`)
    .join(" · ");

  if (loading && !thesis) return null;

  // First run: no thesis yet → onboarding is the front door.
  if (!thesis) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <Eyebrow className="justify-center text-center">A venture OS for solo GPs</Eyebrow>
        <h1 className="mt-4 font-mono text-4xl font-bold leading-tight">
          Decide on any deal
          <br />
          in <span className="text-accent">24 hours.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[13.5px] text-muted">
          VC.Brain sources founders, screens them against your thesis, and hands you a memo with
          citations. You just say yes or no.
        </p>
        <div className="mt-8 flex justify-center gap-2">
          <PrimaryButton onClick={() => router.push("/onboarding")}>Start onboarding →</PrimaryButton>
          <GhostButton onClick={() => setShowApply(true)}>Submit an application</GhostButton>
        </div>
        <p className="mt-4 font-mono text-[11px] text-faint">Ready in 6 minutes.</p>
        {showApply && (
          <ApplyModal onClose={() => setShowApply(false)} onDone={(id) => router.push(`/opportunity/${id}`)} />
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Command header */}
      <div className="border-b border-line px-6 py-6 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Eyebrow>
              Command center ·{" "}
              {new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} local
            </Eyebrow>
            <h1 className="mt-2 font-mono text-[26px] font-bold tracking-tight">
              Good {daypart}
              {firstName ? `, ${firstName}` : ""}.
            </h1>
            <p className="mt-1.5 max-w-2xl text-[13px] text-muted">
              {undecided.length} opportunit{undecided.length === 1 ? "y" : "ies"} on the clock
              {awaiting.length > 0 ? ` — ${awaiting.length} memo${awaiting.length === 1 ? "" : "s"} awaiting your decision` : ""}.{" "}
              {crossed24h.length > 0 ? `${crossed24h.length} strong matches found in the last 24h. ` : ""}
              {calibratedDays != null
                ? `Thesis last calibrated ${calibratedDays === 0 ? "today" : `${calibratedDays}d ago`}.`
                : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <GhostButton onClick={() => setShowApply(true)}>+ New application</GhostButton>
            </div>
            {urgent.length > 0 ? (
              <Link
                href="/pipeline"
                className="flex items-center gap-1.5 border border-warn/40 bg-warnwash px-2.5 py-1 font-mono text-[11px] text-warn"
              >
                ⏱ {urgent.length} under 4h · action required
              </Link>
            ) : null}
            {overdue.length > 0 ? (
              <Link
                href="/diligence"
                className="flex items-center gap-1.5 border border-bad/40 bg-badwash px-2.5 py-1 font-mono text-[11px] text-bad"
              >
                ⚑ {overdue.length} past the 24h window — decide or extend
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="px-6 py-6 md:px-8">
        {sweep.channels.length > 0 ? (
          <div className="mb-5">
            <SweepLoader channels={sweep.channels} running={sweep.running} total={sweep.total} />
          </div>
        ) : null}
        {auto && (auto.working > 0 || auto.queued > 0 || auto.ready + auto.decided < target) ? (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border border-line bg-card px-3.5 py-2.5">
            <span className="flex items-center gap-2.5 font-mono text-[12px] text-muted">
              <Spinner />
              {auto.working > 0 || auto.queued > 0 ? (
                <span>Agents working in the background — <strong className="text-ink">{auto.ready}</strong> ready for you · {auto.working} being checked · {auto.queued} waiting</span>
              ) : (
                <span className="animate-pulse text-accent">Autonomous Agent active — continuously scanning channels for new founders...</span>
              )}
            </span>
            <span className="font-mono text-[10.5px] text-faint">
              full check: background → screen → 3 scores → memo → verify
            </span>
          </div>
        ) : null}
        {(busy || status) && (
          <div className="mb-5 border border-line bg-card px-3 py-2 text-[12.5px]">
            {busy ? <Spinner label={busy} /> : <span className="text-muted">{status}</span>}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <Stat
            label="In pipeline"
            value={undecided.length}
            sub={`${awaiting.length} awaiting your decision · 24h clock running`}
          />
          <Stat label="New finds · 24h" value={signals24h} sub={channelBits || "run a search"} />
          <Stat
            label="Founders in memory"
            value={founderCount?.total ?? "—"}
            sub={founderCount ? `+${founderCount.week} this week` : undefined}
          />
          <Stat label="Avg time to decision" value={fmtDuration(avgTtd)} sub="first signal → human decision" />
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0">
            {/* Fully checked — the finished results */}
            <section className="border border-accent/50 bg-card">
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent">
                  Ready for your decision · fully checked by the agents
                </span>
                {auto && auto.queued > 0 && auto.ready + auto.decided >= target ? (
                  <button onClick={processMore} className="font-mono text-[11px] text-accent hover:underline">
                    Check {AUTOPILOT_DEFAULT_TARGET} more →
                  </button>
                ) : null}
              </div>
              {awaiting.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12.5px] text-faint">
                  {auto && (auto.working > 0 || auto.queued > 0)
                    ? "Agents are running the first full checks — results appear here."
                    : "Nothing waiting on you. The autonomous agent is continuously checking for deals, or you can add an application."}
                </p>
              ) : (
                awaiting
                  .sort((a, b) => (b.axes.founder?.score ?? 0) - (a.axes.founder?.score ?? 0))
                  .slice(0, 10)
                  .map((o) => (
                    <Link
                      key={o.id}
                      href={`/opportunity/${o.id}`}
                      className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-paper"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-mono text-[13px] font-semibold">{o.company}</span>
                          <span className="text-[12px] text-muted">{o.founders[0]?.name ?? ""}</span>
                          {o.recommendation ? (
                            <Badge tone={o.recommendation === "invest" ? "ok" : o.recommendation === "watch" ? "warn" : "bad"}>
                              memo says {o.recommendation === "invest" ? "deploy" : o.recommendation}
                            </Badge>
                          ) : null}
                          {o.flags > 0 ? <Badge tone="warn">⚠ {o.flags} flagged</Badge> : null}
                        </div>
                        <div className="truncate text-[11.5px] text-faint">{o.oneLiner ?? o.convictionReason}</div>
                      </div>
                      <div className="hidden shrink-0 items-center gap-2 sm:flex">
                        {o.axes.founder ? <ScorePill n={o.axes.founder.score} label="F" /> : null}
                        {o.axes.market ? <ScorePill n={o.axes.market.score} label="M" /> : null}
                        {o.axes.idea_vs_market ? <ScorePill n={o.axes.idea_vs_market.score} label="I" /> : null}
                      </div>
                      <Countdown deadline={o.deadlineAt} decided={!!o.decision} />
                      <span className="text-faint">→</span>
                    </Link>
                  ))
              )}
            </section>

            {/* Strong matches still queued */}
            <section className="mt-5 border border-line bg-card">
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">
                  Strong matches from your search (score {threshold}+)
                </span>
                <Link href="/radar" className="font-mono text-[11px] text-accent hover:underline">
                  See all finds →
                </Link>
              </div>
              {crossed.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12.5px] text-faint">
                  No strong matches yet — run a search.
                </p>
              ) : (
                crossed.slice(0, 5).map((o, i) => (
                  <Link
                    key={o.id}
                    href={`/opportunity/${o.id}`}
                    className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-paper"
                  >
                    <span className="tnum shrink-0 font-mono text-[11px] text-faint">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-mono text-[13px] font-semibold">
                          {o.founders[0]?.name ?? "Unknown"}
                        </span>
                        <span className="text-[12px] text-muted">· {o.company}</span>
                        {o.screenResult ? (
                          <Badge tone={o.screenResult === "pass" ? "ok" : "bad"}>
                            {o.screenResult === "pass" ? "passed first check" : "screened out"}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="truncate text-[11.5px] text-faint">{o.convictionReason}</div>
                    </div>
                    <div className="hidden items-center gap-1 sm:flex">
                      <TrendArrow trend={o.axes.founder?.trend} title="founder axis" />
                      <TrendArrow trend={o.axes.market?.trend} title="market axis" />
                      <TrendArrow trend={o.axes.idea_vs_market?.trend} title="idea axis" />
                    </div>
                    <span className="tnum shrink-0 font-mono text-xl font-bold text-accent">{o.convictionScore}</span>
                  </Link>
                ))
              )}
            </section>

            {/* Agent activity */}
            <section className="mt-5 border border-line bg-card">
              <div className="border-b border-line px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">
                Agent activity · reasoning trace
              </div>
              <div className="grid gap-x-6 gap-y-1.5 px-4 py-3 xl:grid-cols-2">
                {activity.length === 0 ? (
                  <p className="py-3 text-center text-[12.5px] text-faint xl:col-span-2">
                    No agent activity yet — run diligence on a deal.
                  </p>
                ) : (
                  activity.map((a) => (
                    <TraceLine
                      key={a.id}
                      at={a.createdAt}
                      agent={`${a.agent}Agent`}
                      text={`${a.company}: ${a.outputSummary ?? ""}`}
                    />
                  ))
                )}
              </div>
            </section>
            <SourcingGraph nodes={graphNodes} />
          </div>

          {/* Quick actions */}
          <aside className="flex flex-col gap-2.5">
            <QuickAction
              href="/thesis"
              title="Edit your thesis"
              sub="Change what you invest in — every future check uses the new profile."
            />
            <QuickAction
              href="/radar"
              title="Find founders"
              sub={`${crossed.length} strong matches so far · we look before they start raising.`}
            />
            <QuickAction
              href="/pipeline"
              title="Open pipeline"
              sub={`${undecided.length} deals in play · ${urgent.length} with less than 4h on the clock.`}
            />
            <QuickAction
              href="/diligence"
              title="Review memos"
              sub={`${awaiting.length} fully checked · waiting on your yes or no.`}
            />
            {/* Top pipeline snapshot */}
            <div className="mt-2 border border-line bg-card">
              <div className="border-b border-line px-3.5 py-2 font-mono text-[10.5px] uppercase tracking-[0.15em] text-muted">
                Next on the clock
              </div>
              {undecided
                .filter((o) => o.deadlineAt && new Date(o.deadlineAt).getTime() > now)
                .sort((a, b) => new Date(a.deadlineAt!).getTime() - new Date(b.deadlineAt!).getTime())
                .slice(0, 4)
                .map((o) => (
                  <Link key={o.id} href={`/opportunity/${o.id}`} className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2 last:border-b-0 hover:bg-paper">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-[12px] font-semibold">{o.company}</div>
                      <div className="truncate text-[10.5px] text-faint">{o.founders[0]?.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {o.axes.founder ? <ScorePill n={o.axes.founder.score} /> : null}
                      <Countdown deadline={o.deadlineAt} decided={!!o.decision} />
                    </div>
                  </Link>
                ))}
            </div>

            {/* Sourcing Suggestions */}
            {suggestions.length > 0 && (
              <div className="mt-2 border border-line bg-card p-3.5 rounded-xl">
                <div className="border-b border-line pb-2 mb-2.5 font-mono text-[10.5px] uppercase tracking-[0.15em] text-muted font-bold">
                  Sourcing suggestions
                </div>
                <div className="space-y-3">
                  {suggestions.map((s, i) => (
                    <div key={i} className="text-[12px] leading-relaxed border-b border-line last:border-0 last:pb-0 pb-2.5">
                      <div className="font-mono font-bold text-accent">{s.channel}</div>
                      <div className="text-muted mt-0.5">{s.why}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {showApply && (
        <ApplyModal
          onClose={() => setShowApply(false)}
          onDone={(id) => {
            setShowApply(false);
            router.push(`/opportunity/${id}`);
          }}
        />
      )}
    </div>
  );
}

function QuickAction({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <Link href={href} className="group border border-line bg-card px-4 py-3.5 transition-colors hover:border-linestrong">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[13px] font-semibold">{title}</span>
        <span className="text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent">→</span>
      </div>
      <p className="mt-1 text-[11.5px] text-muted">{sub}</p>
    </Link>
  );
}

function SourcingGraph({ nodes }: { nodes: GraphNode[] }) {
  if (nodes.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-[12px] text-faint border border-line bg-cardalt rounded-2xl">
        No relationships in sourcing graph yet — scan for candidates.
      </div>
    );
  }

  const width = 450;
  const height = 280;
  const cx = width / 2;
  const cy = height / 2;

  // Distinct institutions
  const institutions = Array.from(new Set(nodes.map((n) => n.institutionName)));
  const instCoords = new Map<string, { x: number; y: number }>();
  
  institutions.forEach((inst, index) => {
    const angle = (index * 2 * Math.PI) / institutions.length;
    const r = 55;
    instCoords.set(inst, {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  });

  // Position nodes
  const nodeCoords = nodes.map((n, index) => {
    const instCoord = instCoords.get(n.institutionName) || { x: cx, y: cy };
    const angle = (index * 2 * Math.PI) / nodes.length;
    const r = 110;
    return {
      ...n,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      ix: instCoord.x,
      iy: instCoord.y,
    };
  });

  return (
    <div className="border border-line bg-card rounded-2xl p-4 u-card mt-5">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted font-bold mb-3 flex items-center justify-between">
        <span>Sourcing Graph Network (Stretch 3)</span>
        <span className="text-accent flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
          Live Moat
        </span>
      </div>
      <div className="relative flex justify-center overflow-hidden">
        <svg width={width} height={height} className="overflow-visible">
          {/* Central Hub */}
          <circle cx={cx} cy={cy} r="14" fill="#0045ff" className="animate-pulse opacity-15" />
          <circle cx={cx} cy={cy} r="8" fill="#0045ff" />
          
          {/* Edges from Center to Institutions */}
          {Array.from(instCoords.entries()).map(([name, coords]) => (
            <line
              key={`c-${name}`}
              x1={cx}
              y1={cy}
              x2={coords.x}
              y2={coords.y}
              stroke="rgba(0, 69, 255, 0.12)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          ))}

          {/* Edges from Institutions to Companies */}
          {nodeCoords.map((n) => (
            <path
              key={`edge-${n.id}`}
              d={`M ${n.ix} ${n.iy} Q ${(n.ix + n.x)/2} ${(n.iy + n.y)/2 - 15} ${n.x} ${n.y}`}
              fill="none"
              stroke="rgba(0, 69, 255, 0.15)"
              strokeWidth="1.5"
            />
          ))}

          {/* Institution Nodes */}
          {Array.from(instCoords.entries()).map(([name, coords]) => (
            <g key={`inst-${name}`}>
              <circle cx={coords.x} cy={coords.y} r="10" fill="#f1f3f7" stroke="#dcdfe8" strokeWidth="1" />
              <circle cx={coords.x} cy={coords.y} r="5" fill="#0045ff" />
              <text
                x={coords.x}
                y={coords.y - 12}
                textAnchor="middle"
                className="font-mono text-[9px] font-bold fill-muted"
              >
                {name}
              </text>
            </g>
          ))}

          {/* Company Nodes */}
          {nodeCoords.map((n) => (
            <g key={`comp-${n.id}`} className="group cursor-pointer">
              <circle cx={n.x} cy={n.y} r="6" fill="#12a150" className="group-hover:scale-125 transition-transform" />
              <text
                x={n.x}
                y={n.y + 14}
                textAnchor="middle"
                className="font-mono text-[8px] fill-ink font-bold opacity-80 group-hover:opacity-100"
              >
                {n.companyName}
              </text>
              <title>{`${n.founderName} @ ${n.companyName} (${n.programName})`}</title>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
