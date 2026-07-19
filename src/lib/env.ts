/**
 * Server-only env access. Never import this in a client component.
 * Values are read lazily so a missing optional key never breaks the build —
 * it only throws at the point of use (with a clear message).
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get openaiApiKey() {
    return required("OPENAI_API_KEY");
  },
  get tavilyApiKey() {
    return required("TAVILY_API_KEY");
  },
  get githubToken() {
    return optional("GITHUB_TOKEN"); // optional: raises rate limits when present
  },
  get elevenLabsApiKey() {
    return optional("ELEVENLABS_API_KEY"); // optional: audio memo only
  },
  /**
   * Absolute base URL of this deployment — used to build shareable links that
   * live OUTSIDE the app (e.g. the /apply?ref= link inside a cold-outreach
   * draft). Prefers an explicit canonical domain, then Vercel's per-deploy URL,
   * then localhost for dev. Never hardcode localhost in shipped links.
   */
  get appUrl() {
    const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
    if (explicit) return explicit.replace(/\/+$/, "");
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return "http://localhost:3000";
  },
  /**
   * SMTP mail (all optional — the mailer silently no-ops when unset, and the
   * founder loop still works via the /apply/status link). For Hostinger:
   * SMTP_HOST=smtp.hostinger.com, SMTP_PORT=465, SMTP_USER=the mailbox address,
   * SMTP_PASS=its password, MAIL_FROM='VC.Brain <mailbox@domain>'.
   */
  get smtpHost() {
    return optional("SMTP_HOST");
  },
  get smtpPort() {
    const raw = optional("SMTP_PORT");
    return raw ? Number(raw) : 465;
  },
  get smtpUser() {
    return optional("SMTP_USER");
  },
  get smtpPass() {
    return optional("SMTP_PASS");
  },
  get mailFrom() {
    return optional("MAIL_FROM") || optional("SMTP_USER");
  },
  get cloudinaryCloudName() {
    return optional("CLOUDINARY_CLOUD_NAME");
  },
  get cloudinaryApiKey() {
    return optional("CLOUDINARY_API_KEY");
  },
  get cloudinaryApiSecret() {
    return optional("CLOUDINARY_API_SECRET");
  },
  /** Model used for extraction, scoring, memo, query parsing. */
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o",
};
