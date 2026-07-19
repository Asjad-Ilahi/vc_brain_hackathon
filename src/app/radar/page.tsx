"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { OpportunitySummary } from "@/lib/services/list";
import type { Thesis } from "@/lib/services/thesis";
import { api, postJson } from "../_components/api";
import { Badge, Chip, Modal, ScorePill, Spinner, TrendArrow } from "../_components/ui";
import { CHANNEL_SIGNAL, GhostButton, ListSearch, PageHeader, PrimaryButton, initialsOf } from "../_components/shared";
import { SweepLoader, useSweep } from "../_components/useSweep";

type ChannelStat = { name: string; found: number; scored: number; avgConviction: number; converted: number; quality: number };
type GraphNode = { id: string; institutionName: string; programName: string; qualityRating: number; companyName: string; founderName: string; opportunityId: string };
type ChannelIntel = { channels: ChannelStat[]; suggestions: { channel: string; why: string }[]; graphNodes: GraphNode[] };

const SOURCEABLE = ["github", "hackernews", "arxiv", "producthunt", "hackathons", "patents", "accelerators", "web"] as const;

export default function RadarPage() {
  const router = useRouter();
  const [opps, setOpps] = useState<OpportunitySummary[]>([]);
  const [thesis, setThesis] = useState<Thesis | null>(null);
  const [channels, setChannels] = useState<ChannelIntel | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [outreach, setOutreach] = useState<{ company: string; draft: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState(""); // client-side filter over loaded cards
  const [searching, setSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [o, t, c] = await Promise.all([
        api<OpportunitySummary[]>("/api/opportunities"),
        api<{ active: Thesis | null }>("/api/thesis"),
        api<ChannelIntel>("/api/channels").catch(() => null),
      ]);
      setOpps(o);
      setThesis(t.active);
      setChannels(c);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const executeLoad = async () => {
      await load();
    };
    executeLoad();
  }, [load]);

  async function handleManualSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchStatus("Searching deeply across GitHub, arXiv, LinkedIn and Web...");
    setStatus(null);
    // Guard against a hung/slow request — surface a clear flag instead of a
    // spinner that never resolves.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const r = await api<{ created: string[]; message?: string }>("/api/founders/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
        signal: controller.signal,
      });
      if (r.created.length > 0) {
        setSearchStatus(null);
        setSearchQuery("");
        setStatus(`✓ Found and verified ${r.created.length} founder(s) matching "${q}".`);
        await load();
        router.push(`/opportunity/${r.created[0]}`);
      } else {
        setSearchStatus(null);
        setStatus(r.message || `No founders found matching "${q}". Try a full name, GitHub login, or a more specific keyword.`);
      }
    } catch (err) {
      console.error(err);
      setSearchStatus(null);
      setStatus(
        (err as Error).name === "AbortError"
          ? `The deep search for "${q}" took too long and was stopped. Try a more specific query and run it again.`
          : `Search failed: ${(err as Error).message}. Please try again.`
      );
    } finally {
      clearTimeout(timer);
      setSearching(false);
    }
  }

  const radar = useMemo(
    () =>
      opps
        .filter((o) => o.source === "outbound" && !o.decision)
        .sort((a, b) => (b.convictionScore ?? 0) - (a.convictionScore ?? 0)),
    [opps]
  );
  const threshold = thesis?.convictionThreshold ?? 68;

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of radar) m.set(o.sourceChannel ?? "other", (m.get(o.sourceChannel ?? "other") ?? 0) + 1);
    return m;
  }, [radar]);
  const coldStartCount = radar.filter((o) => o.founders.some((f) => f.isColdStart)).length;

  const groupedGraph = useMemo(() => {
    if (!channels?.graphNodes) return [];
    const map = new Map<string, Map<string, Array<{ founderName: string; companyName: string; opportunityId: string }>>>();
    for (const n of channels.graphNodes) {
      if (!map.has(n.institutionName)) map.set(n.institutionName, new Map());
      const inst = map.get(n.institutionName)!;
      if (!inst.has(n.programName)) inst.set(n.programName, []);
      inst.get(n.programName)!.push({
        founderName: n.founderName,
        companyName: n.companyName,
        opportunityId: n.opportunityId,
      });
    }
    return [...map.entries()];
  }, [channels]);

  const term = searchTerm.trim().toLowerCase();
  const shown = radar
    .filter((o) => {
      if (filter === "all") return true;
      if (filter === "coldstart") return o.founders.some((f) => f.isColdStart);
      return o.sourceChannel === filter;
    })
    .filter((o) => !term || [o.company, o.founders[0]?.name, o.sector, o.geography, o.oneLiner, o.convictionReason].filter(Boolean).join(" ").toLowerCase().includes(term));

  const sweep = useSweep(load);

  async function source(kind: string) {
    setStatus(null);
    if (kind === "all") {
      sweep.start(((thesis?.profileJson ?? null) as { enabledSources?: string[] } | null)?.enabledSources);
      return;
    }
    setBusy(kind);
    try {
      const r = await postJson<{ created: string[] }>(`/api/source/${kind}`);
      setStatus(`${r.created.length} new from ${kind} — repeat finds update the existing card instead of duplicating.`);
      await load();
    } catch (e) {
      setStatus(`Sourcing failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function activate(o: OpportunitySummary) {
    setBusy(`activate:${o.id}`);
    try {
      const r = await postJson<{ draftMessage: string }>(`/api/opportunities/${o.id}/outreach`);
      setOutreach({ company: o.company, draft: r.draftMessage });
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Module 02 / Track B · Outbound radar"
        title="Founders you haven't met yet."
        sub="We scan 8 public sources for people building things that fit your thesis. Every card is backed by real, linked evidence. Activate writes a draft intro — it never sends money."
        right={
          <span className="flex items-center gap-1.5 u-card px-2.5 py-1 text-[11px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" /> {SOURCEABLE.length} sources · scans daily + on demand
          </span>
        }
      />

      <div className="space-y-4">
        {/* Deep Manual Search Box */}
        <div className="mb-6 bg-[#F8F8F8] rounded-[24px] p-6 border-0 shadow-none">
          <h2 className="text-[11.5px] uppercase tracking-wider text-[#0045FF] font-bold mb-2.5">Deep search for new founders</h2>
          <form onSubmit={handleManualSearch} className="flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={searching}
              className="flex-1 bg-white border-0 rounded-full px-6 py-3 text-[12.5px] text-ink focus:outline-none placeholder-[#a0a0a0]"
              placeholder="Enter founder name, GitHub login, research paper title, or project keywords..."
            />
            <PrimaryButton type="submit" disabled={searching || !searchQuery.trim()}>
              {searching ? "Deep Searching..." : "⚡ Deep Search & Verify"}
            </PrimaryButton>
          </form>
          {searchStatus && (
            <div className="mt-3 flex items-center gap-2 text-[11.5px] text-[#0045FF] animate-pulse">
              <Spinner />
              <span>{searchStatus} (This runs real audits across GitHub, arXiv, LinkedIn, and Web - may take up to 45s)</span>
            </div>
          )}
        </div>

        {/* Filter the founders already on the radar */}
        {radar.length > 0 ? (
          <ListSearch value={searchTerm} onChange={setSearchTerm} placeholder="Filter these founders by name, company, sector…" />
        ) : null}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            All signals · {radar.length}
          </Chip>
          <Chip active={filter === "coldstart"} onClick={() => setFilter("coldstart")}>
            New founders · {coldStartCount}
          </Chip>
          {[...counts.entries()]
            .filter(([k]) => k !== "other")
            .sort((a, b) => b[1] - a[1])
            .map(([k, n]) => (
              <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>
                {k} · {n}
              </Chip>
            ))}
          <span className="ml-auto text-[11px] text-faint">Sort: signal strength ↓</span>
        </div>

        {sweep.channels.length > 0 ? (
          <div className="mt-4">
            <SweepLoader channels={sweep.channels} running={sweep.running} total={sweep.total} />
          </div>
        ) : null}
        {busy ? (
          <div className="mt-4 u-card px-3 py-2 text-[12.5px]">
            {busy.startsWith("activate") ? <Spinner label="Drafting the intro…" /> : <Spinner label={`Searching ${busy}…`} />}
          </div>
        ) : status ? (
          <div
            className={`mt-4 flex items-start gap-2 rounded-2xl px-4 py-3 text-[12.5px] font-semibold ${
              status.startsWith("✓") ? "bg-okwash text-ok" : "bg-warnwash text-warn"
            }`}
          >
            <span>{status.startsWith("✓") ? "" : "⚠"}</span>
            <span>{status}</span>
          </div>
        ) : null}

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_290px]">
          {/* Cards */}
          <div className="min-w-0">
            {shown.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-linestrong py-16 text-center text-[13px] text-faint">
                Nothing here{filter !== "all" ? " for this filter" : ""} yet — run a search from the panel on the right.
              </div>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {shown.map((o) => (
                  <RadarCard key={o.id} o={o} threshold={threshold} onActivate={() => activate(o)} busy={busy === `activate:${o.id}`} />
                ))}
              </div>
            )}
          </div>

          {/* Channel rail */}
          <aside className="flex flex-col gap-4">
            <div className="bg-[#F8F8F8] rounded-[24px] border-0 p-6 shadow-none">
              <div className="text-[10.5px] uppercase tracking-wider text-muted font-bold mb-2">Sweep a channel</div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {SOURCEABLE.map((k) => (
                  <Chip key={k} onClick={() => source(k)} disabled={!!busy}>
                    + {k}
                  </Chip>
                ))}
              </div>
              <div className="mt-3">
                <PrimaryButton onClick={() => source("all")} disabled={!!busy || sweep.running}>⚡ Find founders now</PrimaryButton>
              </div>
            </div>

            {channels && (
              <div className="bg-[#F8F8F8] rounded-[24px] border-0 p-6 shadow-none">
                <div className="text-[10.5px] uppercase tracking-wider text-muted font-bold">Channel intelligence</div>
                <p className="mt-0.5 text-[11px] text-faint">Which sources find your best founders — learns from your decisions.</p>
                <div className="mt-3 space-y-2.5">
                  {channels.channels.length === 0 ? (
                    <p className="text-[12px] text-faint">No channels used yet.</p>
                  ) : (
                    channels.channels.map((c) => {
                      const max = Math.max(1, ...channels.channels.map((x) => x.quality));
                      return (
                        <div key={c.name}>
                          <div className="flex items-center justify-between text-[11px]">
                            <span>{c.name}</span>
                            <span className="tnum text-faint">
                              q{c.quality} · {c.found} found · {c.converted} converted
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full bg-[#eceef3] rounded-full overflow-hidden">
                            <div className="h-full bg-[#0045FF] rounded-full" style={{ width: `${(c.quality / max) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {channels.suggestions.length > 0 && (
                  <div className="mt-4 border-t border-[#eceef3] pt-3">
                    <div className="text-[10.5px] uppercase tracking-wide text-warn">Underexplored</div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {channels.suggestions.map((s) => (
                        <Badge key={s.channel} tone="warn" title={s.why}>
                          {s.channel}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {groupedGraph.length > 0 && (
              <div className="bg-[#F8F8F8] rounded-[24px] border-0 p-6 shadow-none">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted font-bold">Sourcing Graph</div>
                <p className="mt-0.5 text-[11px] text-faint">Network path: Institution → Program → Founder</p>
                <div className="mt-3 space-y-4 max-h-[350px] overflow-y-auto pr-1">
                  {groupedGraph.map(([instName, programs]) => (
                    <div key={instName} className="border-l border-[#eceef3] pl-2.5 space-y-2">
                      <div className="font-mono text-[11px] font-bold text-[#0045FF]">{instName}</div>
                      {[...programs.entries()].map(([progName, items]) => (
                        <div key={progName} className="border-l border-[#0045FF]/20 pl-2.5 space-y-1">
                          <div className="font-mono text-[9.5px] text-muted uppercase tracking-wide">{progName}</div>
                          {items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-[11.5px] leading-snug">
                              <span className="text-faint">↳</span>
                              <Link href={`/opportunity/${item.opportunityId}`} className="hover:text-[#0045FF] font-mono truncate text-muted">
                                <span className="font-semibold text-ink hover:text-[#0045FF]">{item.founderName}</span>
                                <span className="text-faint"> @{item.companyName}</span>
                              </Link>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {outreach && (
        <Modal title={`Draft outreach — ${outreach.company}`} onClose={() => setOutreach(null)}>
          <div className="border border-ok/40 bg-okwash px-3 py-1.5 text-[11px] text-ok">
            Drafted, not sent — activation triggers a real application, never an investment.
          </div>
          <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed">{outreach.draft}</p>
          <div className="mt-4 flex justify-end">
            <GhostButton onClick={() => setOutreach(null)}>Close</GhostButton>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Resolved email + public profiles — so the investor doesn't have to go look. */
function ContactRail({
  email,
  f,
}: {
  email: string | null;
  f?: { githubLogin: string | null; linkedinUrl: string | null; twitterHandle: string | null };
}) {
  const links = [
    f?.githubLogin ? { label: "GitHub", href: `https://github.com/${f.githubLogin}` } : null,
    f?.linkedinUrl ? { label: "LinkedIn", href: f.linkedinUrl } : null,
    f?.twitterHandle ? { label: "X", href: `https://x.com/${f.twitterHandle.replace(/^@/, "")}` } : null,
  ].filter(Boolean) as { label: string; href: string }[];
  if (!email && links.length === 0) return null;
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
      {email ? (
        <a
          href={`mailto:${email}`}
          onClick={stop}
          title={email}
          className="inline-flex max-w-[190px] items-center gap-1 truncate rounded-full bg-[#EBF0FF] px-2 py-0.5 text-[10px] font-semibold text-[#0045FF] hover:underline"
        >
          ✉ <span className="truncate">{email}</span>
        </a>
      ) : null}
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noreferrer"
          onClick={stop}
          className="rounded-full border border-[#eceef3] px-2 py-0.5 text-[10px] font-semibold text-muted transition-colors hover:border-[#0045FF] hover:text-[#0045FF]"
        >
          {l.label} ↗
        </a>
      ))}
    </div>
  );
}

function RadarCard({
  o,
  threshold,
  onActivate,
  busy,
}: {
  o: OpportunitySummary;
  threshold: number;
  onActivate: () => void;
  busy: boolean;
}) {
  const f = o.founders[0];
  const cold = o.founders.some((x) => x.isColdStart);
  const signal = CHANNEL_SIGNAL[o.sourceChannel ?? ""] ?? "Signal";
  // The company/project is always a real entity — lead with it. The founder is
  // enrichment: a real name, an @handle, or an honest "unidentified" (never junk).
  const person = f && f.nameResolved ? f.name : null;
  const avatarText = person && !f!.isHandle ? initialsOf(person) : initialsOf(o.company);
  return (
    <div className="flex flex-col bg-white rounded-[24px] border border-[#eceef3] shadow-none overflow-hidden hover:border-[#0045FF]/40 transition-colors">
      <div className="flex items-center gap-3 border-b border-[#eceef3] p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#eceef3] bg-[#F8F8F8] text-[#0045FF] text-[12px] font-bold">
          {avatarText}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[13.5px] font-bold text-ink">{o.company}</span>
            {o.sector ? (
              <span className="rounded-full bg-[#EBF0FF] text-[#0045FF] text-[10px] px-2.5 py-0.5 font-bold font-sans">
                {o.sector}
              </span>
            ) : null}
          </div>
          <div className="truncate text-[11.5px] text-muted">
            {person ? (
              <>
                {f!.isHandle ? "" : "Founder · "}
                <span className={f!.isHandle ? "font-mono text-[11px]" : ""}>{person}</span>
              </>
            ) : (
              <span className="text-faint">Founder unidentified{cold ? " · cold-start" : ""}</span>
            )}
            {o.geography ? ` · ${o.geography}` : ""}
          </div>
        </div>
      </div>
      <div className="flex-1 p-4">
        <div className={`text-[10px] font-bold uppercase tracking-wider ${cold ? "text-[#E0355A]" : "text-[#0045FF]"}`}>
          {cold ? `New founder · ${signal}` : signal}
        </div>
        <p className="mt-1.5 line-clamp-2 text-[12.5px] text-muted leading-relaxed font-sans">{o.oneLiner ?? o.convictionReason}</p>
        <p className="mt-1 line-clamp-1 text-[11px] text-faint font-sans">why now: {o.convictionReason ?? "—"}</p>
        <ContactRail email={o.applicantEmail ?? null} f={f} />
        <div className="mt-4 flex items-end justify-between">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[#9E9E9E] font-medium font-sans">Match</div>
              <div className={`tnum text-[24px] font-bold leading-none mt-0.5 ${(o.convictionScore ?? 0) >= threshold ? "text-[#0045FF]" : "text-ink"}`}>
                {o.convictionScore ?? "—"}
              </div>
            </div>
            {f && f.nameResolved ? (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#9E9E9E] font-medium font-sans">Founder</div>
                <div className="mt-1"><ScorePill n={f.founderScore} /></div>
              </div>
            ) : null}
            <div className="flex items-center gap-1 pb-0.5">
              <TrendArrow trend={o.axes.market?.trend} title="market" />
              <TrendArrow trend={o.axes.idea_vs_market?.trend} title="idea" />
            </div>
          </div>
          {o.screenResult ? (
            <Badge tone={o.screenResult === "pass" ? "ok" : "bad"}>
              {o.screenResult === "pass" ? "screened: pass" : "screened out"}
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-[#eceef3]">
        <button
          onClick={onActivate}
          disabled={busy}
          className="border-r border-[#eceef3] px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-[#0045FF] transition-colors hover:bg-[#F8F8F8] disabled:opacity-50 cursor-pointer"
        >
          {busy ? "Drafting…" : "⚡ Activate → outreach"}
        </button>
        <Link
          href={`/opportunity/${o.id}`}
          className="px-3 py-2.5 text-center text-[10.5px] font-bold uppercase tracking-wider text-muted transition-colors hover:bg-[#F8F8F8] hover:text-ink"
        >
          Assess →
        </Link>
      </div>
    </div>
  );
}
