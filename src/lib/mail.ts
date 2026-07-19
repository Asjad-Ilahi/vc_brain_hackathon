/**
 * Outbound email — the founder-facing half of the 24h promise.
 * FAIL-SOFT BY DESIGN: when SMTP env vars are absent (or a send fails) the app
 * behaves exactly as before — founders still have their /apply/status link.
 * Callers therefore never await-and-throw on mail; sendMail reports, not raises.
 * Node runtime only (nodemailer) — the routes that use this already declare it.
 */
import nodemailer from "nodemailer";
import { env } from "./env";

export function mailConfigured(): boolean {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass);
}

function transporter() {
  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465, // 465 = implicit TLS (Hostinger default); 587 = STARTTLS
    auth: { user: env.smtpUser, pass: env.smtpPass },
  });
}

export async function sendMail(to: string, subject: string, text: string, html?: string): Promise<{ sent: boolean }> {
  if (!mailConfigured()) {
    console.log(`[mail] SMTP not configured — skipped "${subject}" to ${to}`);
    return { sent: false };
  }
  try {
    await transporter().sendMail({ from: env.mailFrom, to, subject, text, html });
    return { sent: true };
  } catch (err) {
    console.error(`[mail] send failed ("${subject}" to ${to}):`, err);
    return { sent: false };
  }
}

/* ------------------------- founder-loop templates ------------------------- */

function shell(title: string, bodyHtml: string, statusUrl: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;background-color:#0d0f1d;color:#ffffff;padding:40px 20px;border-radius:16px;">
  <div style="text-align:center;padding-bottom:24px;">
    <span style="font-family:monospace;font-weight:800;font-size:16px;letter-spacing:.2em;color:#0045FF;">VC.BRAIN</span>
  </div>
  <div style="background-color:#161936;border:1px solid rgba(0, 69, 255, 0.25);border-radius:14px;padding:32px;box-shadow:0 8px 32px rgba(0, 0, 0, 0.24);">
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">${title}</h2>
    <div style="color:#e2eaff;font-size:14px;line-height:1.6;margin-bottom:20px;">
      ${bodyHtml}
    </div>
    <div style="text-align:center;margin-top:24px;margin-bottom:16px;">
      <a href="${statusUrl}" style="display:inline-block;background:#0045FF;color:#ffffff;text-decoration:none;font-weight:700;font-size:13.5px;padding:12px 24px;border-radius:9999px;box-shadow:0 4px 12px rgba(0, 69, 255, 0.35);letter-spacing:0.02em;">Track Application Status</a>
    </div>
    <p style="margin:20px 0 0;font-size:11.5px;color:#98a1b2;line-height:1.5;border-top:1px solid rgba(0, 69, 255, 0.15);padding-top:16px;text-align:center;">
      This private link is your tracking dashboard (no login required):<br>
      <a href="${statusUrl}" style="color:#4d7fff;text-decoration:none;">${statusUrl}</a>
    </p>
  </div>
</div>`;
}

/** Sent right after a founder applies: confirms receipt + hands them the status link. */
export async function sendApplicationReceived(to: string, company: string, publicRef: string) {
  const statusUrl = `${env.appUrl}/apply/status?ref=${publicRef}`;
  const text = `We received your application for ${company}.

Our screening agents are auditing your pitch against the fund thesis and your public footprint. A human investor makes the final call — expect a decision within 24 hours.

Track your application (no account needed):
${statusUrl}`;
  return sendMail(
    to,
    `Application received — ${company}`,
    text,
    shell(
      "Application received",
      `<p style="margin:0;font-size:14px;line-height:1.6;color:#e2eaff">Your application for <b style="color:#ffffff">${company}</b> is in the assessment queue. Our agents are auditing the pitch against the fund thesis and your public footprint — a human investor makes the final call within <b style="color:#ffffff">24 hours</b>.</p>`,
      statusUrl
    )
  );
}

const DECISION_COPY: Record<string, { subject: string; headline: string; body: string }> = {
  invest: {
    subject: "Good news — the fund wants to go further",
    headline: "We're advancing",
    body: "The investor reviewed the full diligence and wants to take this further. Expect a direct follow-up shortly.",
  },
  watch: {
    subject: "Decision: you're on our watchlist",
    headline: "On the watchlist",
    body: "Not a yes yet — the fund is tracking your progress and may re-engage as you hit new milestones. Your founder profile stays in our memory.",
  },
  pass: {
    subject: "Decision on your application",
    headline: "Not this round",
    body: "The fund isn't moving forward right now. This isn't permanent — founders are re-evaluated whenever new signals appear, and your track record persists.",
  },
};

/** Sent when the investor records the human decision — the 24h promise, kept. */
export async function sendDecisionEmail(
  to: string,
  company: string,
  publicRef: string,
  decision: string,
  feedback?: string | null
) {
  const copy = DECISION_COPY[decision] ?? DECISION_COPY.pass;
  const statusUrl = `${env.appUrl}/apply/status?ref=${publicRef}`;
  const fb = feedback ? `\n\nInvestor feedback:\n"${feedback}"` : "";
  const text = `${copy.headline} — ${company}.

${copy.body}${fb}

Full status:
${statusUrl}`;
  return sendMail(
    to,
    `${copy.subject} — ${company}`,
    text,
    shell(
      copy.headline,
      `<p style="margin:0;font-size:14px;line-height:1.6;color:#e2eaff">${copy.body}</p>` +
        (feedback
          ? `<p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#ffffff;border-left:3px solid #0045FF;padding-left:12px;font-style:italic;">“${feedback}”</p>`
          : ""),
      statusUrl
    )
  );
}
