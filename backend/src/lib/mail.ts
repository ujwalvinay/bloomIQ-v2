import { getEnv } from "@/lib/env";

function appOriginForResetLinks(): string {
  const raw = process.env.APP_ORIGIN?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "http://localhost:3001";
}

export function buildPasswordResetUrl(token: string): string {
  const base = appOriginForResetLinks();
  const q = new URLSearchParams({ token });
  return `${base}/reset-password?${q.toString()}`;
}

/**
 * Sends via Resend when RESEND_API_KEY and MAIL_FROM are set (required in production).
 * In development, logs the reset URL if those variables are missing.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  const env = getEnv();
  const from = process.env.MAIL_FROM?.trim();
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey || !from) {
    if (env.NODE_ENV === "development") {
      console.info(`[BloomIQ password reset] to=${to}\n  ${resetUrl}`);
      return;
    }
    throw new Error(
      "RESEND_API_KEY and MAIL_FROM must be configured to send email in production"
    );
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Reset your BloomIQ password",
      html: `<p>You asked to reset your BloomIQ password.</p>
<p><a href="${resetUrl}">Choose a new password</a></p>
<p>This link expires in one hour. If you didn’t request this, you can ignore this email.</p>`,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Email delivery failed (${res.status}): ${text}`);
  }
}
