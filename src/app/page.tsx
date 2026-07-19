import Link from "next/link";

/** Public landing — "Decide on any deal in 24 hours." */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-paper">
      {/* Nav */}
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <span className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center bg-accent text-accentink">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M9 1 3 9h4l-1 6 6-8H8l1-6z" />
              </svg>
            </span>
            <span className="font-mono text-sm font-bold tracking-wide">VC.BRAIN</span>
          </span>
          <nav className="flex items-center gap-3">
            <Link href="/signin" className="px-2 py-1.5 font-mono text-[12px] text-muted hover:text-ink">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="bg-accent px-3.5 py-2 font-mono text-[12px] font-semibold uppercase tracking-wide text-accentink hover:opacity-90"
            >
              Get started →
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-5 py-24 text-center md:py-32">
          <span className="inline-flex items-center gap-1.5 border border-line bg-card px-2.5 py-1 font-mono text-[11px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" /> A venture OS for solo GPs
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl font-mono text-[clamp(34px,6vw,58px)] font-bold leading-[1.08] tracking-tight">
            Decide on any deal
            <br />
            in <span className="text-accent">24 hours.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-muted">
            VC.Brain sources founders, screens them against your thesis, and hands you a memo with
            citations. You just say yes or no.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-2.5">
            <Link
              href="/signup"
              className="bg-accent px-5 py-2.5 font-mono text-[13px] font-semibold uppercase tracking-wide text-accentink hover:opacity-90"
            >
              Start onboarding →
            </Link>
            <Link
              href="/signin"
              className="border border-line bg-card px-5 py-2.5 font-mono text-[13px] uppercase tracking-wide text-muted hover:border-linestrong hover:text-ink"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-line bg-card">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">How it works</div>
          <h2 className="mt-3 font-mono text-[28px] font-bold tracking-tight">Four steps. Nothing fancy.</h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["01", "Set your thesis", "Pick sectors, stages, geographies and a few sliders. That's it."],
              ["02", "We find founders", "Radar scans GitHub, arXiv, Product Hunt, hackathons, patents and more — before they raise."],
              ["03", "Screen in one place", "Every deal gets 3 independent scores: Founder, Market, Idea. Never averaged."],
              ["04", "Decide in 24h", "Read a cited memo. Click Deploy or Reject. Done."],
            ].map(([n, title, body]) => (
              <div key={n} className="border border-line bg-paper p-5">
                <div className="font-mono text-[11px] font-bold text-accent">{n}</div>
                <h3 className="mt-2 font-mono text-[15px] font-bold">{title}</h3>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's inside */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">What's inside</div>
          <h2 className="mt-3 font-mono text-[28px] font-bold tracking-tight">Six tools, one workflow.</h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Thesis", "Your investing rules, encoded."],
              ["Radar", "Outbound sourcing on autopilot."],
              ["Pipeline", "24h decision queue."],
              ["Diligence", "Split-screen deep-dive with citations."],
              ["Memos", "Auto-drafted investment memos."],
              ["Founders", "Every founder you've ever seen — remembered."],
            ].map(([title, body]) => (
              <div key={title} className="border border-line bg-card p-5">
                <h3 className="font-mono text-[15px] font-bold">{title}</h3>
                <p className="mt-1.5 text-[12.5px] text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-b border-line bg-card">
        <div className="mx-auto max-w-6xl px-5 py-20 text-center">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-full border-2 border-accent font-mono text-[15px] font-bold text-accent">
            ⏱
          </div>
          <h2 className="mt-5 font-mono text-[30px] font-bold tracking-tight">Ready in 6 minutes.</h2>
          <p className="mt-2 text-[13.5px] text-muted">Answer a few questions. Walk out with a live pipeline.</p>
          <Link
            href="/signup"
            className="mt-7 inline-block bg-accent px-5 py-2.5 font-mono text-[13px] font-semibold uppercase tracking-wide text-accentink hover:opacity-90"
          >
            Begin onboarding →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-6 font-mono text-[11px] text-faint">
        <span>© VC.Brain · v0.9</span>
        <span>Sourcing → Screening → Diligence → Decision · one human in the loop</span>
      </footer>
    </div>
  );
}
