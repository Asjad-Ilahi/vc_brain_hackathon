"use client";
import Link from "next/link";
import DarkVeilClient from "./_components/DarkVeilClient";

/* ─── SVG Shape Illustrations for step cards ─── */

/** 01 — Triangle (Set your thesis) */
function ShapeThesis() {
  return (
    <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* outer blurred ring */}
      <ellipse cx="100" cy="82" rx="72" ry="72" fill="rgba(0,69,255,0.08)" />
      <ellipse cx="100" cy="82" rx="56" ry="56" fill="rgba(0,69,255,0.10)" />
      <ellipse cx="100" cy="82" rx="42" ry="42" fill="rgba(0,69,255,0.13)" />
      {/* outer triangle */}
      <polygon points="100,20 164,138 36,138" fill="rgba(0,69,255,0.35)" />
      {/* mid triangle */}
      <polygon points="100,36 151,128 49,128" fill="rgba(0,69,255,0.55)" />
      {/* inner triangle */}
      <polygon points="100,52 138,118 62,118" fill="#0045FF" />
    </svg>
  );
}

/** 02 — Horizontal bars (We find founders / Radar) */
function ShapeRadar() {
  return (
    <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect x="24" y="52" width="152" height="18" rx="2" fill="rgba(0,69,255,0.18)" />
      <rect x="24" y="74" width="152" height="18" rx="2" fill="rgba(0,69,255,0.35)" />
      <rect x="24" y="96" width="152" height="18" rx="2" fill="#0045FF" />
    </svg>
  );
}

/** 03 — Star/Cross (Screen in one place) */
function ShapeScreen() {
  return (
    <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <ellipse cx="100" cy="80" rx="70" ry="70" fill="rgba(0,69,255,0.06)" />
      <ellipse cx="100" cy="80" rx="54" ry="54" fill="rgba(0,69,255,0.10)" />
      <ellipse cx="100" cy="80" rx="40" ry="40" fill="rgba(0,69,255,0.15)" />
      {/* 4-point star */}
      <path
        d="M100 30 C100 30 108 62 130 80 C108 98 100 130 100 130 C100 130 92 98 70 80 C92 62 100 30 100 30Z"
        fill="rgba(0,69,255,0.45)"
      />
      <path
        d="M100 44 C100 44 106 66 122 80 C106 94 100 116 100 116 C100 116 94 94 78 80 C94 66 100 44 100 44Z"
        fill="#0045FF"
      />
    </svg>
  );
}

/** 04 — Diamond (Decide in 24h) */
function ShapeDiamond() {
  return (
    <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <ellipse cx="100" cy="80" rx="68" ry="68" fill="rgba(0,69,255,0.07)" />
      <ellipse cx="100" cy="80" rx="52" ry="52" fill="rgba(0,69,255,0.11)" />
      {/* outer diamond */}
      <polygon points="100,18 156,80 100,142 44,80" fill="rgba(0,69,255,0.30)" />
      {/* mid diamond */}
      <polygon points="100,30 144,80 100,130 56,80" fill="rgba(0,69,255,0.52)" />
      {/* inner diamond */}
      <polygon points="100,44 134,80 100,116 66,80" fill="#0045FF" />
    </svg>
  );
}

/* ─── Tool SVG icons for "Six tools" section ─── */
function IconThesisTool() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="rgba(0,69,255,0.08)" />
      <path d="M12 28L20 12L28 28" stroke="#0045FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.5 23h11" stroke="#0045FF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconRadarTool() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="rgba(0,69,255,0.08)" />
      <circle cx="20" cy="20" r="10" stroke="#0045FF" strokeWidth="1.5" />
      <circle cx="20" cy="20" r="6" stroke="#0045FF" strokeWidth="1.5" />
      <circle cx="20" cy="20" r="2.5" fill="#0045FF" />
      <line x1="20" y1="20" x2="28" y2="12" stroke="#0045FF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconPipelineTool() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="rgba(0,69,255,0.08)" />
      <rect x="10" y="13" width="20" height="14" rx="2" stroke="#0045FF" strokeWidth="1.5" />
      <path d="M14 20h5M23 20l-2-2 2 2-2 2" stroke="#0045FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* hourglass */}
      <path d="M22 16v4l3 4h-7l3-4v-4h1" stroke="#0045FF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconDiligenceTool() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="rgba(0,69,255,0.08)" />
      <path d="M13 12h9l5 5v11H13z" stroke="#0045FF" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M22 12v5h5" stroke="#0045FF" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="16" y1="21" x2="24" y2="21" stroke="#0045FF" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="24.5" x2="24" y2="24.5" stroke="#0045FF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconMemosTool() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="rgba(0,69,255,0.08)" />
      <rect x="11" y="11" width="18" height="18" rx="2" stroke="#0045FF" strokeWidth="1.5" />
      <line x1="15" y1="16" x2="25" y2="16" stroke="#0045FF" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="15" y1="20" x2="25" y2="20" stroke="#0045FF" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="15" y1="24" x2="21" y2="24" stroke="#0045FF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconMemoryTool() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="rgba(0,69,255,0.08)" />
      <circle cx="20" cy="16" r="5" stroke="#0045FF" strokeWidth="1.5" />
      <path d="M10 30c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="#0045FF" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="29" cy="18" r="3" stroke="#0045FF" strokeWidth="1.2" />
    </svg>
  );
}

/* ─── Step card number badge ─── */
function StepBadge({ n }: { n: string }) {
  return (
    <div className="step-badge">
      {n}
    </div>
  );
}

/** Public landing page — VC.Brain */
export default function LandingPage() {
  const TICKER_ITEMS = [
    "Investment Intelligence",
    "Rapid Decisions",
    "Founder Discovery",
    "Investment Intelligence",
    "Rapid Decisions",
    "Founder Discovery",
    "Investment Intelligence",
    "Rapid Decisions",
    "Founder Discovery",
    "Investment Intelligence",
    "Rapid Decisions",
    "Founder Discovery",
  ];

  const STEPS = [
    {
      n: "01",
      title: "Set your thesis",
      body: "Pick sectors, stages, geographies and a few sliders. That's it.",
      image: "/section2/image1.svg",
    },
    {
      n: "02",
      title: "We find founders",
      body: "Radar scans GitHub, arXiv, ProductHunt and more, before they raise.",
      image: "/section2/image2.svg",
    },
    {
      n: "03",
      title: "Screen in one place",
      body: "Every deal gets 3 independent scores: Founder, Market, Idea.",
      image: "/section2/image3.svg",
    },
    {
      n: "04",
      title: "Decide in 24h",
      body: "Read a cited memo. Click Deploy or Reject. Done.",
      image: "/section2/image4.svg",
    },
  ];

  const TOOLS = [
    {
      n: "01",
      title: "Thesis",
      body: "Define your investing rules encoded once, applied everywhere, continuously refined.",
      image: "/section3/image1.svg",
    },
    {
      n: "02",
      title: "Radar",
      body: "Community-matched outbound that delivers deal-appropriate opportunities directly to you.",
      image: "/section3/image2.svg",
    },
    {
      n: "03",
      title: "Pipeline",
      body: "Manage the entire 24-hour decision cycle to track and deploy capital to your targets.",
      image: "/section3/image3.svg",
    },
    {
      n: "04",
      title: "Diligence",
      body: "Autonomous, comprehensive diligence on each investment opportunity, informed by your framework.",
      image: "/section3/image4.svg",
    },
    {
      n: "05",
      title: "Memos",
      body: "Purpose-built to surface localized investment analysis autonomously for every deal.",
      image: "/section3/image5.svg",
    },
    {
      n: "06",
      title: "Memory",
      body: "Automatically build a canonical intelligence network helping you stay sharp in changing markets.",
      image: "/section3/image6.svg",
    },
  ];

  return (
    <div className="min-h-screen bg-paper text-ink">

      {/* ─────────────────── NAV ─────────────────── */}
      <header
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 28px",
            height: "68px",
          }}
        >
          {/* Logo */}
          <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                width: "32px",
                height: "32px",
                display: "grid",
                placeItems: "center",
                border: "1.5px solid rgba(255,255,255,0.5)",
                borderRadius: "6px",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                <path d="M9 1 3 9h4l-1 6 6-8H8l1-6z" />
              </svg>
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: "#fff",
              }}
            >
              VC.BRAIN
            </span>
          </span>

          {/* CTA */}
          <div style={{ display: "flex", gap: "2px" }}>
            <Link
              href="/signup"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 20px",
                background: "#fff",
                color: "#0045FF",
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
                fontWeight: 600,
                textDecoration: "none",
                borderRadius: "4px",
              }}
            >
              Get Started
            </Link>
            <Link
              href="/signup"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 14px",
                background: "#fff",
                color: "#0045FF",
                borderRadius: "4px",
                textDecoration: "none",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* ─────────────────── HERO ─────────────────── */}
      <section
        style={{
          position: "relative",
          minHeight: "100vh",
          background: "linear-gradient(180deg, #0045FF 0%, #002999 100%)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            opacity: 0.4,
            mixBlendMode: "screen",
            filter: "brightness(2) contrast(1.5)",
          }}
        >
          <DarkVeilClient
            hueShift={220}
            noiseIntensity={0.04}
            scanlineIntensity={0}
            speed={0.4}
            scanlineFrequency={0}
            warpAmount={0.3}
          />
        </div>

        {/* Hero content */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "120px 24px 80px",
            maxWidth: "900px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              color: "rgba(255,255,255,0.75)",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              letterSpacing: "0.06em",
              marginBottom: "28px",
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>+</span>
            A venture OS for solo GPs
          </div>

          {/* Headline */}
          <h1
            style={{
              color: "#fff",
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(42px, 7vw, 72px)",
              fontWeight: 400,
              lineHeight: 1.06,
              letterSpacing: "-0.05em",
              margin: "0 0 28px",
            }}
          >
            Decide on any deal
            <br />
            in{" "}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              {/* Animated Hourglass icon */}
              <svg
                width="52"
                height="52"
                viewBox="0 0 52 52"
                fill="none"
                style={{ display: "inline-block", verticalAlign: "middle", marginBottom: "4px" }}
              >
                <rect width="52" height="52" rx="10" fill="rgba(255,255,255,0.15)" />
                <g className="hourglass-spin">
                  {/* Frame */}
                  <path d="M18 12h16M18 40h16M20 12v8l6 6-6 6v8M32 12v8l-6 6 6 6v8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Top sand */}
                  <polygon points="20,13 32,13 26,19" fill="white" className="sand-top" />
                  {/* Bottom sand */}
                  <polygon points="26,33 32,39 20,39" fill="white" className="sand-bottom" />
                  {/* Stream */}
                  <line x1="26" y1="19" x2="26" y2="39" stroke="white" strokeWidth="1.5" className="sand-stream" />
                </g>
              </svg>
              24 hours.
            </span>
          </h1>

          {/* Subhead */}
          <p
            style={{
              color: "rgba(255,255,255,0.72)",
              fontSize: "16px",
              lineHeight: 1.65,
              maxWidth: "520px",
              margin: "0 0 40px",
            }}
          >
            VC.Brain sources founders, screens them against your thesis, and hands
            you a memo with citations. You just say yes or no.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
            <Link
              href="/signin"
              style={{
                padding: "14px 28px",
                border: "1.5px solid rgba(255,255,255,0.85)",
                color: "#fff",
                fontFamily: "var(--font-sans)",
                fontSize: "15px",
                fontWeight: 500,
                textDecoration: "none",
                transition: "background 0.2s",
                borderRadius: "6px",
              }}
            >
              See Demo
            </Link>

            <div style={{ display: "flex", gap: "6px" }}>
              <Link
                href="/signup"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "14px 24px",
                  background: "#fff",
                  color: "#000",
                  fontFamily: "var(--font-sans)",
                  fontSize: "15px",
                  fontWeight: 600,
                  textDecoration: "none",
                  borderRadius: "6px",
                }}
              >
                Start Onboarding
              </Link>
              <Link
                href="/signup"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 18px",
                  background: "#fff",
                  color: "#000",
                  borderRadius: "6px",
                  textDecoration: "none",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Ticker strip at bottom of hero ── */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            borderTop: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(0,0,0,0.18)",
            padding: "14px 0",
            overflow: "hidden",
          }}
        >
          <div
            className="animate-ticker"
            style={{
              display: "flex",
              gap: "0",
              whiteSpace: "nowrap",
              width: "max-content",
            }}
          >
            {TICKER_ITEMS.concat(TICKER_ITEMS).map((item, i) => (
              <span
                key={i}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0 36px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  letterSpacing: "0.12em",
                  color: i % 3 === 1 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                  fontWeight: i % 3 === 1 ? 600 : 400,
                  borderRight: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────── HOW IT WORKS ─────────────────── */}
      <section style={{ background: "#fff", padding: "100px 24px", overflow: "hidden" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          {/* Section label */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px", marginLeft: "196px" }}>
            <span
              style={{
                color: "#0045FF",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                letterSpacing: "0.12em",
              }}
            >
              + How It Works
            </span>
          </div>

          {/* Heading row with line */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginBottom: "56px",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", position: "relative", width: "180px", flexShrink: 0 }}>
              <div style={{
                position: "absolute",
                left: "-100vw",
                right: "6px",
                height: "1px",
                background: "#0045FF",
              }} />
              <div style={{
                position: "absolute",
                right: 0,
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#0045FF",
              }} />
            </div>
            <h2
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "clamp(28px, 3.5vw, 42px)",
                fontWeight: 400,
                color: "#000",
                margin: 0,
                letterSpacing: "-0.05em",
              }}
            >
              Four steps. Nothing fancy.
            </h2>
          </div>

          {/* Step cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
            }}
          >
            {STEPS.map(({ n, title, body, image }) => (
              <div
                key={n}
                style={{
                  background: "transparent",
                  border: "1px solid #E0E0E0",
                  borderRadius: "4px",
                  padding: "28px 24px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0",
                  transition: "box-shadow 0.2s, transform 0.2s",
                  cursor: "default",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(0,69,255,0.10)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  (e.currentTarget as HTMLElement).style.transform = "none";
                }}
              >
                {/* Step badge */}
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "rgba(0,69,255,0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#0045FF",
                    marginBottom: "20px",
                    boxShadow: "0 0 0 4px rgba(0,69,255,0.05), 0 0 0 8px rgba(0,69,255,0.03)",
                  }}
                >
                  {n}
                </div>

                {/* Shape illustration */}
                <div style={{
                  height: "180px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "20px",
                  ...(n === "02" ? { marginLeft: "-24px", marginRight: "-24px", width: "calc(100% + 48px)" } : {})
                }}>
                  <img src={image} alt={title} style={{ width: "100%", height: "100%", objectFit: n === "02" ? "fill" : "contain" }} />
                </div>

                {/* Text */}
                <h3
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#000",
                    margin: "0 0 8px",
                  }}
                >
                  {title}
                </h3>
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    color: "#6E6E6E",
                    lineHeight: 1.65,
                    margin: 0,
                  }}
                >
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────── SIX TOOLS ─────────────────── */}
      <section style={{ background: "#fff", padding: "100px 24px", overflow: "hidden" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          {/* Section label */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px", marginLeft: "196px" }}>
            <span
              style={{
                color: "#0045FF",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                letterSpacing: "0.12em",
              }}
            >
              + Six Works
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "52px",
              position: "relative",
              marginLeft: "196px",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "clamp(28px, 3.5vw, 42px)",
                fontWeight: 400,
                color: "#000",
                margin: 0,
                letterSpacing: "-0.05em",
              }}
            >
              Six tools, one workflow.
            </h2>
            <div style={{ display: "flex", alignItems: "center", position: "relative", flexGrow: 1, marginLeft: "16px" }}>
              <div style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#0045FF",
                flexShrink: 0,
              }} />
              <div style={{
                position: "absolute",
                left: "6px",
                right: "-100vw",
                height: "1px",
                background: "#0045FF",
              }} />
            </div>
          </div>

          {/* Tools grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "16px",
            }}
          >
            {TOOLS.map(({ image, n, title, body }) => (
              <div
                key={n}
                style={{
                  background: "#F8F8F8",
                  border: "none",
                  borderRadius: "4px",
                  padding: "16px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  transition: "box-shadow 0.2s, transform 0.2s",
                  cursor: "default",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(0,69,255,0.10)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  (e.currentTarget as HTMLElement).style.transform = "none";
                }}
              >
                {/* Number badge */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: "rgba(0,69,255,0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#0045FF",
                    }}
                  >
                    {n}
                  </div>
                </div>

                {/* Illustration */}
                <div style={{ height: "240px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" }}>
                  <img src={image} alt={title} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                </div>

                <div>
                  <h3
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "15px",
                      fontWeight: 700,
                      color: "#0045FF",
                      margin: "0 0 6px",
                    }}
                  >
                    {title}
                  </h3>
                  <p
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: "#6E6E6E",
                      lineHeight: 1.65,
                      margin: 0,
                    }}
                  >
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────── CTA ─────────────────── */}
      <section
        style={{
          background: "linear-gradient(160deg, #0045FF 0%, #002999 100%)",
          padding: "100px 24px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle DarkVeil overlay on CTA too */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.12, zIndex: 0 }}>
          <DarkVeilClient hueShift={200} noiseIntensity={0.03} speed={0.3} warpAmount={0.2} />
        </div>

        <div style={{ position: "relative", zIndex: 10, maxWidth: "640px", margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(48px, 8vw, 84px)",
              fontWeight: 400,
              color: "#fff",
              margin: "0 0 16px",
              letterSpacing: "-0.05em",
              lineHeight: 1.06,
            }}
          >
            Ready in 6 minutes
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.72)",
              fontSize: "15px",
              margin: "0 0 40px",
            }}
          >
            Answer a few questions. Walk out with a live pipeline.
          </p>
          <div style={{ display: "inline-flex", gap: "6px", alignItems: "stretch", justifyContent: "center" }}>
            <Link
              href="/signup"
              className="cta-btn-main"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "18px 36px",
                background: "#fff",
                color: "#000",
                fontFamily: "var(--font-sans)",
                fontSize: "18px",
                fontWeight: 600,
                textDecoration: "none",
                borderRadius: "4px",
              }}
            >
              Start Onboarding
            </Link>
            <Link
              href="/signup"
              className="cta-btn-arrow"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 22px",
                background: "#fff",
                color: "#000",
                borderRadius: "4px",
                textDecoration: "none",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────── FOOTER ─────────────────── */}
      <footer
        style={{
          background: "#fff",
          borderTop: "1px solid #E0E0E0",
          padding: "24px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "#9E9E9E",
          }}
        >
          © VC.Brain · v0.9
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "#9E9E9E",
          }}
        >
          Sourcing → Screening → Diligence → Decision · one human in the loop
        </span>
      </footer>
    </div>
  );
}
