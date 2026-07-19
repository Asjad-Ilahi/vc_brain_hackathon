"use client";
import { useState } from "react";
import { api } from "./api";
import { Eyebrow, Modal, inputCls, labelCls } from "./ui";

/** Signal-type header per channel — "GITHUB VELOCITY", "ARXIV PAPER"… */
export const CHANNEL_SIGNAL: Record<string, string> = {
  github: "GitHub velocity",
  hackernews: "Show HN launch",
  arxiv: "arXiv paper",
  producthunt: "Product Hunt launch",
  hackathons: "Hackathon win",
  patents: "Patent filing",
  accelerators: "Accelerator cohort",
  web: "Web signal",
  application: "Inbound application",
};

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function PageHeader({
  eyebrow,
  title,
  sub,
  right,
}: {
  eyebrow: string;
  title: string;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="border-b border-line px-6 py-6 md:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-2 font-mono text-[26px] font-bold leading-tight tracking-tight">{title}</h1>
          {sub ? <p className="mt-1.5 max-w-2xl text-[13px] text-muted">{sub}</p> : null}
        </div>
        {right ? <div className="flex shrink-0 flex-col items-end gap-2">{right}</div> : null}
      </div>
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  tone = "accent",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "accent" | "ink" | "ok";
  type?: "button" | "submit" | "reset";
}) {
  const cls =
    tone === "ok"
      ? "bg-ok text-white hover:opacity-90"
      : tone === "ink"
        ? "bg-ink text-paper hover:opacity-90"
        : "bg-accent text-accentink hover:opacity-90";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-3.5 py-2 font-mono text-[12px] font-semibold uppercase tracking-wide transition-opacity disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="border border-line bg-card px-3.5 py-2 font-mono text-[12px] uppercase tracking-wide text-muted transition-colors hover:border-linestrong hover:text-ink disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** Inbound application — deck + company name is the minimum bar. */
export function ApplyModal({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const [companyName, setCompanyName] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!companyName && !text && !file) {
      setErr("Add a company name and a deck (file or pasted text).");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("companyName", companyName);
      if (text) fd.set("text", text);
      if (file) fd.set("deck", file);
      const r = await api<{ opportunityId: string }>("/api/apply", { method: "POST", body: fd });
      onDone(r.opportunityId);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="New application — deck + company name" onClose={onClose}>
      <label className={labelCls}>Company name</label>
      <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} placeholder="Acme AI" />
      <label className={`mt-3 ${labelCls}`}>Deck (PDF or image)</label>
      <input
        type="file"
        accept=".pdf,image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="mt-1 w-full text-[12px] text-muted file:mr-3 file:border file:border-line file:bg-paper file:px-3 file:py-1.5 file:font-mono file:text-[11px] file:uppercase file:text-muted"
      />
      <label className={`mt-3 ${labelCls}`}>…or paste deck text</label>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className={inputCls} placeholder="Problem, product, team, traction…" />
      <p className="mt-2 text-[11px] text-faint">That's the whole form — over-collecting works against a 24-hour decision.</p>
      {err ? <p className="mt-2 text-[12px] text-bad">{err}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton onClick={submit} disabled={loading}>
          {loading ? "Parsing + screening…" : "Submit application"}
        </PrimaryButton>
      </div>
    </Modal>
  );
}
