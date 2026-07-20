/**
 * Recreations of the product's actual UI primitives (u-card, pills, eyebrows,
 * stat tiles, score pills). These are the same shapes/colours the investor sees
 * in the app, rebuilt as vectors/DOM so the video is never a screenshot.
 */
import React from "react";
import { c, shadow, r, font, brandGradient } from "../theme";

/* ------------------------------- typography ------------------------------- */

export const Eyebrow: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <div
    style={{
      fontFamily: font.sans,
      fontSize: 20,
      fontWeight: 800,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      color: c.brand,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Title: React.FC<{
  children: React.ReactNode;
  size?: number;
  style?: React.CSSProperties;
}> = ({ children, size = 92, style }) => (
  <h1
    style={{
      fontFamily: font.sans,
      fontSize: size,
      lineHeight: 1.04,
      fontWeight: 800,
      letterSpacing: "-0.035em",
      color: c.ink,
      margin: 0,
      ...style,
    }}
  >
    {children}
  </h1>
);

export const Sub: React.FC<{
  children: React.ReactNode;
  size?: number;
  style?: React.CSSProperties;
}> = ({ children, size = 30, style }) => (
  <p
    style={{
      fontFamily: font.sans,
      fontSize: size,
      lineHeight: 1.45,
      fontWeight: 500,
      color: c.muted,
      margin: 0,
      ...style,
    }}
  >
    {children}
  </p>
);

/* --------------------------------- surfaces -------------------------------- */

/** The app's white rounded card (`.u-card`). */
export const Card: React.FC<{
  children?: React.ReactNode;
  style?: React.CSSProperties;
  pad?: number;
  radius?: number;
  glow?: boolean;
}> = ({ children, style, pad = 28, radius = r.card, glow }) => (
  <div
    style={{
      background: c.card,
      border: `1px solid ${c.line}`,
      borderRadius: radius,
      padding: pad,
      boxShadow: glow ? shadow.glow : shadow.card,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Light-gray container panel (`.u-panel`). */
export const Panel: React.FC<{
  children?: React.ReactNode;
  style?: React.CSSProperties;
  pad?: number;
}> = ({ children, style, pad = 30 }) => (
  <div
    style={{
      background: c.panel,
      borderRadius: r.panel,
      padding: pad,
      ...style,
    }}
  >
    {children}
  </div>
);

/* ---------------------------------- pills ---------------------------------- */

type Tone = "brand" | "ok" | "warn" | "bad" | "neutral";
const TONE: Record<Tone, { bg: string; fg: string }> = {
  brand: { bg: c.brandfaint, fg: c.brand },
  ok: { bg: c.okwash, fg: c.ok },
  warn: { bg: c.warnwash, fg: c.warn },
  bad: { bg: c.badwash, fg: c.bad },
  neutral: { bg: c.panel, fg: c.muted },
};

export const Pill: React.FC<{
  children: React.ReactNode;
  tone?: Tone;
  size?: number;
  style?: React.CSSProperties;
}> = ({ children, tone = "brand", size = 19, style }) => {
  const t = TONE[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: t.bg,
        color: t.fg,
        borderRadius: r.pill,
        padding: `${size * 0.42}px ${size * 0.95}px`,
        fontFamily: font.sans,
        fontSize: size,
        fontWeight: 700,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
};

/** Primary blue pill button (`.u-btn-primary`). */
export const PrimaryButton: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 12,
      background: brandGradient,
      color: "#fff",
      borderRadius: r.pill,
      padding: "22px 44px",
      fontFamily: font.sans,
      fontSize: 26,
      fontWeight: 700,
      boxShadow: "0 10px 34px rgba(0,69,255,0.34)",
      ...style,
    }}
  >
    {children}
  </span>
);

/* -------------------------------- data bits -------------------------------- */

/** The dashboard's blue-circle stat card. */
export const StatTile: React.FC<{
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ label, value, icon, style }) => (
  <Card pad={24} style={{ display: "flex", alignItems: "center", gap: 18, ...style }}>
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: brandGradient,
        display: "grid",
        placeItems: "center",
        color: "#fff",
        fontSize: 24,
        flexShrink: 0,
      }}
    >
      {icon ?? "◆"}
    </div>
    <div>
      <div
        style={{
          fontFamily: font.sans,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: c.faint,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: font.sans,
          fontSize: 40,
          fontWeight: 800,
          color: c.ink,
          lineHeight: 1.1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  </Card>
);

/** The 3-axis score readout (Founder / Market / Idea — never blended). */
export const AxisScore: React.FC<{
  label: string;
  value: number;
  tone?: string;
}> = ({ label, value, tone = c.brand }) => (
  <div style={{ flex: 1 }}>
    <div
      style={{
        fontFamily: font.sans,
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        color: c.faint,
        marginBottom: 6,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: font.sans,
        fontSize: 44,
        fontWeight: 800,
        color: tone,
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </div>
    <div
      style={{
        marginTop: 10,
        height: 7,
        borderRadius: 999,
        background: c.line,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${value}%`,
          height: "100%",
          borderRadius: 999,
          background: tone,
        }}
      />
    </div>
  </div>
);
