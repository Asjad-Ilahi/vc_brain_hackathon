"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Thesis, ThesisProfile } from "@/lib/services/thesis";
import { api, postJson } from "../_components/api";
import { Chip, Eyebrow, Spinner, inputCls, labelCls } from "../_components/ui";
import { GhostButton, PageHeader, PrimaryButton } from "../_components/shared";
import {
  ARCHETYPE_OPTIONS,
  DEFAULT_DRAFT,
  GEO_OPTIONS,
  SECTOR_OPTIONS,
  SOURCE_OPTIONS,
  STAGE_OPTIONS,
  type ThesisDraft as Draft,
  deriveAxisWeights,
  draftFromThesis,
  thesisPayload,
} from "../_components/thesisOptions";

export default function ThesisPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState<Thesis | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api<{ active: Thesis | null }>("/api/thesis")
      .then((t) => {
        setLoaded(t.active);
        setDraft(t.active ? draftFromThesis(t.active) : DEFAULT_DRAFT);
      })
      .finally(() => setLoading(false));
  }, []);

  const weights = useMemo(
    () => (draft ? deriveAxisWeights(draft.riskScore, draft.traits) : null),
    [draft]
  );

  if (loading || !draft)
    return (
      <div className="py-24 text-center">
        <Spinner label="Loading thesis…" />
      </div>
    );

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });
  const toggle = (k: "sectors" | "stages" | "geographies" | "archetypes" | "enabledSources", v: string) => {
    const cur = draft[k];
    set(k, cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
  };

  async function commit() {
    if (!draft) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await postJson<{ archivedStaleHypotheses?: number }>("/api/thesis", {
        ...thesisPayload(draft, (loaded?.profileJson ?? null) as ThesisProfile | null),
        // New lens → unassessed radar hypotheses from the old lens are archived
        // (kept in Memory, hidden from working views) so the pipeline reflects
        // THIS thesis, not the last one.
        archiveStale: true,
      });
      const n = r.archivedStaleHypotheses ?? 0;
      setMsg(
        `Thesis committed · every downstream score now filters through this lens.${
          n > 0 ? ` ${n} unassessed hypothesis${n === 1 ? "" : "es"} from the previous lens archived · run a radar sweep to repopulate.` : ""
        }`
      );
      router.refresh();
    } catch (e) {
      setMsg(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Module 01 · Thesis engine"
        title="Define the fund's lens."
        sub="Before the system evaluates a single founder, calibrate structural constraints, risk appetite, and the founder lens. Every downstream score is filtered through this."
        right={
          <div className="flex gap-2">
            <GhostButton onClick={() => setDraft(loaded ? draftFromThesis(loaded) : DEFAULT_DRAFT)}>
              ↺ Reset draft
            </GhostButton>
            <PrimaryButton onClick={commit} disabled={saving}>
              {saving ? "Committing…" : "▣ Commit thesis"}
            </PrimaryButton>
          </div>
        }
      />

      <div className="grid gap-8 px-6 py-6 md:px-8 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-8">
          {msg ? <div className="u-card px-3 py-2 text-[12.5px] text-muted">{msg}</div> : null}

          <Section n="1.1" title="Sector focus" sub="Multi-select. Recommendations outside these sectors surface as adjacent only.">
            <div className="flex flex-wrap gap-1.5">
              {SECTOR_OPTIONS.map((s) => (
                <Chip key={s} active={draft.sectors.includes(s)} onClick={() => toggle("sectors", s)}>
                  {s}
                </Chip>
              ))}
            </div>
          </Section>

          <Section n="1.2" title="Stage & check" sub="Baseline check drives the deploy button; ownership target drives dilution modeling in the memo.">
            <div className="flex flex-wrap gap-1.5">
              {STAGE_OPTIONS.map((s) => (
                <Chip key={s} active={draft.stages.includes(s)} onClick={() => toggle("stages", s)}>
                  {s}
                </Chip>
              ))}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelCls}>Check min (USD)</label>
                <input
                  type="number"
                  step={25_000}
                  value={draft.checkSizeMinUsd}
                  onChange={(e) => set("checkSizeMinUsd", Number(e.target.value) || 0)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Check max (USD)</label>
                <input
                  type="number"
                  step={25_000}
                  value={draft.checkSizeMaxUsd}
                  onChange={(e) => set("checkSizeMaxUsd", Number(e.target.value) || 0)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Ownership target %</label>
                <input
                  type="number"
                  step={0.5}
                  value={draft.ownershipTargetPct}
                  onChange={(e) => set("ownershipTargetPct", Number(e.target.value) || 0)}
                  className={inputCls}
                />
              </div>
            </div>
          </Section>

          <Section n="1.3" title="Geography" sub="Physical HQ or founder residence. Global-remote founders are always in scope.">
            <div className="flex flex-wrap gap-1.5">
              {GEO_OPTIONS.map((g) => (
                <Chip key={g} active={draft.geographies.includes(g)} onClick={() => toggle("geographies", g)}>
                  {g}
                </Chip>
              ))}
            </div>
          </Section>

          <Section n="2.1" title="Risk appetite" sub="Contrarian = back people earlier with less proof. Consensus = wait for traction. This sets the scoring weights.">
            <Slider
              value={draft.riskScore}
              onChange={(v) => set("riskScore", v)}
              left="Contrarian"
              right="Consensus"
            />
          </Section>

          <Section n="2.2" title="Match threshold" sub="Founders scoring above this get fully checked automatically. Higher = fewer, sharper deals.">
            <Slider
              value={draft.convictionThreshold}
              onChange={(v) => set("convictionThreshold", v)}
              left="Broad"
              right="Selective"
            />
          </Section>

          <Section n="2.3" title="Founder lens" sub="Archetypes bias sourcing · Radar surfaces founders matching this pattern before they enter public fundraising.">
            <div className="flex flex-wrap gap-1.5">
              {ARCHETYPE_OPTIONS.map((a) => (
                <Chip key={a} active={draft.archetypes.includes(a)} onClick={() => toggle("archetypes", a)}>
                  {a}
                </Chip>
              ))}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["technicalDepth", "Technical depth"],
                  ["distributionInstinct", "Distribution instinct"],
                  ["storytelling", "Storytelling"],
                ] as const
              ).map(([k, label]) => (
                <div key={k} className="bg-[#F8F8F8] rounded-[20px] p-4 border-0">
                  <div className={labelCls}>{label}</div>
                  <div className="tnum mt-1 text-[22px] font-bold text-[#0045FF]">{draft.traits[k]}</div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={draft.traits[k]}
                    onChange={(e) => set("traits", { ...draft.traits, [k]: Number(e.target.value) })}
                    className="mt-1 w-full accent-[#0045FF]"
                  />
                </div>
              ))}
            </div>
          </Section>

          <Section n="3.1" title="Deal-breakers" sub="Plain English. The agents enforce these on every founder they check.">
            <textarea
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              placeholder="No prior VC backing on pre-seed. English-fluent. Willing to relocate for ≥Series A."
              className={inputCls}
            />
          </Section>

          <Section n="3.2" title="Signal sources" sub="Each source has its own trust level. Enable only what matches your conviction style · more sources ≠ better.">
            <div className="flex flex-wrap gap-1.5">
              {SOURCE_OPTIONS.map((s) => (
                <Chip key={s.id} active={draft.enabledSources.includes(s.id)} onClick={() => toggle("enabledSources", s.id)}>
                  {s.label}
                </Chip>
              ))}
            </div>
          </Section>
        </div>

        {/* Preview rail */}
        <aside className="h-fit bg-[#F8F8F8] rounded-[24px] border-0 p-6 lg:sticky lg:top-4 shadow-none">
          <Eyebrow>Preview weight</Eyebrow>
          <p className="mt-1 text-[11px] text-faint">How this lens tilts the three axes (never averaged · read separately).</p>
          {weights ? (
            <div className="mt-3 space-y-3">
              {(
                [
                  ["Founder axis", weights.founder],
                  ["Market axis", weights.market],
                  ["Idea axis", weights.idea],
                ] as const
              ).map(([label, w]) => (
                <div key={label}>
                  <div className="flex items-center justify-between text-[11.5px] font-sans font-medium text-ink">
                    <span>{label}</span>
                    <span className="tnum font-bold text-[#0045FF]">{w.toFixed(2)}</span>
                  </div>
                  <div className="mt-1 h-1.5 bg-[#eceef3] rounded-full overflow-hidden">
                    <div className="h-full bg-[#0045FF] rounded-full" style={{ width: `${w * 200}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-4 border-t border-[#eceef3] pt-3 text-[11px] text-muted">
            Deploy button: ${(draft.checkSizeMinUsd / 1000).toFixed(0)}K for {draft.ownershipTargetPct}%
          </div>
          <div className="mt-1 text-[11px] text-muted">
            Auto-check founders scoring ≥ {draft.convictionThreshold}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ n, title, sub, children }: { n: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline gap-2.5">
        <span className="text-[11px] font-bold text-[#0045FF]">{n}</span>
        <h2 className="text-[16px] font-bold">{title}</h2>
      </div>
      <p className="mt-1 max-w-xl text-[12px] text-muted">{sub}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Slider({ value, onChange, left, right }: { value: number; onChange: (v: number) => void; left: string; right: string }) {
  return (
    <div className="max-w-md">
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#0045FF]"
      />
      <div className="flex items-center justify-between text-[11px] text-faint">
        <span>{left}</span>
        <span className="tnum text-[13px] font-bold text-[#0045FF]">{value}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}
