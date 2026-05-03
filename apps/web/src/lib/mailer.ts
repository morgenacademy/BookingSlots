// Minimal Mailjet REST wrapper. If env vars are missing we log instead of
// throwing so the surrounding business logic doesn't break in dev.
type SendArgs = {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendMail({ to, toName, subject, html, text }: SendArgs) {
  const apiKey = process.env.MAILJET_API_KEY;
  const apiSecret = process.env.MAILJET_API_SECRET;
  const fromEmail = process.env.MAIL_FROM_EMAIL;
  const fromName = process.env.MAIL_FROM_NAME ?? 'House of Eve';

  if (!apiKey || !apiSecret || !fromEmail) {
    console.warn('[mailer] skipping send — Mailjet env vars missing', { to, subject });
    return { skipped: true as const };
  }

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  const res = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: fromEmail, Name: fromName },
          To: [{ Email: to, Name: toName ?? to }],
          Subject: subject,
          HTMLPart: html,
          TextPart: text ?? html.replace(/<[^>]+>/g, ''),
        },
      ],
    }),
  });

  if (!res.ok) {
    console.error('[mailer] mailjet failed', res.status, await res.text());
    return { skipped: false as const, ok: false };
  }
  return { skipped: false as const, ok: true };
}
