/**
 * ODIN design tokens — lifted VERBATIM from the app's `src/app/globals.css`
 * (@theme block) so the video is pixel-consistent with the product.
 *
 * We use inline styles driven by these tokens rather than Tailwind-in-Remotion:
 * it renders deterministically in headless Chrome (no build step to break mid
 * render) while using the exact same hex values as the website.
 */

export const c = {
  /* Brand blues */
  brand: "#0045ff",
  branddeep: "#0033cc",
  brandlight: "#4d7fff",
  brandsoft: "#5f83ff",
  brandfaint: "#eaf0ff",
  brandwash: "#e2eaff",

  /* Canvas / surfaces */
  paper: "#ffffff",
  card: "#ffffff",
  panel: "#f1f3f7",
  cardalt: "#f6f7fa",
  canvas: "#f7f8fb", // the app's page background

  /* Ink */
  ink: "#10132a",
  muted: "#667085",
  faint: "#98a1b2",

  /* Borders */
  line: "#eceef3",
  linestrong: "#dcdfe8",

  /* Semantic */
  ok: "#12a150",
  okwash: "#e7f6ee",
  warn: "#b7791f",
  warnwash: "#fdf2d8",
  bad: "#e0355a",
  badwash: "#fdeaee",
} as const;

/** The app's soft card shadow (`.u-card` / `.u-soft`). */
export const shadow = {
  card: "0 1px 2px rgba(16,19,42,0.04), 0 8px 24px rgba(16,19,42,0.06)",
  soft: "0 10px 40px rgba(16,19,42,0.08)",
  lift: "0 18px 60px rgba(16,19,42,0.12)",
  glow: `0 0 0 1px ${c.brandwash}, 0 12px 40px rgba(0,69,255,0.22)`,
};

/** Radii — the app uses generous pills and 24/28px cards. */
export const r = {
  card: 24,
  panel: 28,
  pill: 9999,
  sm: 12,
};

export const font = {
  sans: "Urbanist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace",
};

/** Signature brand gradient (blue sidebar / primary button). */
export const brandGradient = `linear-gradient(160deg, ${c.brand} 0%, ${c.branddeep} 100%)`;
