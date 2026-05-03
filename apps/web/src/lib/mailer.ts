// Resend transactional sender. If env vars are missing we log and return
// instead of throwing so the surrounding business logic doesn't break in
// dev or before secrets are wired up.
type SendArgs = {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendMail({ to, toName, subject, html, text }: SendArgs) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.MAIL_FROM_EMAIL;
  const fromName = process.env.MAIL_FROM_NAME ?? 'House of Eve';

  if (!apiKey || !fromEmail) {
    console.warn('[mailer] skipping send — RESEND_API_KEY or MAIL_FROM_EMAIL missing', {
      to,
      subject,
    });
    return { skipped: true as const };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: toName ? [`${toName} <${to}>`] : [to],
      subject,
      html,
      text: text ?? html.replace(/<[^>]+>/g, ''),
    }),
  });

  if (!res.ok) {
    console.error('[mailer] resend failed', res.status, await res.text());
    return { skipped: false as const, ok: false };
  }
  return { skipped: false as const, ok: true };
}
