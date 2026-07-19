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
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#10132a">
  <div style="padding:20px 0 12px;font-weight:800;font-size:15px;letter-spacing:.08em">VC.BRAIN</div>
  <div style="border:1px solid #eceef3;border-radius:14px;padding:24px">
    <h2 style="margin:0 0 10px;font-size:19px">${title}</h2>
    ${bodyHtml}
    <a href="${statusUrl}" style="display:inline-block;margin-top:18px;background:#0045FF;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:8px">Track your application</a>
    <p style="margin:14px 0 0;font-size:12px;color:#98a1b2">This private link is your status page — no account needed:<br>${statusUrl}</p>
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
      `<p style="margin:0;font-size:14px;line-height:1.6;color:#667085">Your application for <b style="color:#10132a">${company}</b> is in the assessment queue. Our agents are auditing the pitch against the fund thesis and your public footprint — a human investor makes the final call within <b style="color:#10132a">24 hours</b>.</p>`,
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
      `<p style="margin:0;font-size:14px;line-height:1.6;color:#667085">${copy.body}</p>` +
        (feedback
          ? `<p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#10132a;border-left:3px solid #0045FF;padding-left:12px">“${feedback}”</p>`
          : ""),
      statusUrl
    )
  );
}
