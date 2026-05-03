'use server';

import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { sendMail } from '@/lib/mailer';

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const next = String(formData.get('next') ?? '/account');
  if (!email) return;

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const admin = getSupabaseAdmin();

  // Pick magiclink for existing users, signup for new ones — generateLink
  // requires the right `type` to materialise an account on first use.
  const { data: list } = await admin.auth.admin.listUsers();
  const exists = list?.users.some((u) => u.email?.toLowerCase() === email);

  const { data: link, error } = exists
    ? await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
      })
    : await admin.auth.admin.generateLink({
        type: 'signup',
        email,
        password: crypto.randomUUID(), // placeholder; not used (passwordless)
        options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });

  if (error || !link?.properties?.hashed_token) {
    console.error('[auth] generateLink failed', error);
    redirect('/login?error=' + encodeURIComponent(error?.message ?? 'kon link niet maken'));
  }

  const type = exists ? 'magiclink' : 'signup';
  const url = `${origin}/auth/callback?token_hash=${link.properties.hashed_token}&type=${type}&next=${encodeURIComponent(next)}`;

  await sendMail({
    to: email,
    subject: exists
      ? 'Inloggen bij House of Eve'
      : 'Bevestig je account bij House of Eve',
    html: emailHtml({ url, isSignup: !exists }),
  });

  redirect('/login?sent=1');
}

function emailHtml({ url, isSignup }: { url: string; isSignup: boolean }) {
  const heading = isSignup ? 'Welkom bij House of Eve.' : 'Welkom terug.';
  const intro = isSignup
    ? 'Klik hieronder om je account te bevestigen — daarna kun je een strippenkaart kopen en lessen boeken.'
    : 'Klik op de knop hieronder om in te loggen op je House of Eve account. De link is 1 uur geldig en eenmalig te gebruiken.';
  const cta = isSignup ? 'Bevestig mijn account' : 'Log in';

  return `
<!DOCTYPE html>
<html lang="nl"><body style="margin:0;padding:0;background:#f7f3ee;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1a1a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ee;padding:40px 16px;"><tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:24px;overflow:hidden;">
<tr><td style="padding:40px 40px 8px 40px;"><div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;letter-spacing:0.02em;">House of Eve</div></td></tr>
<tr><td style="padding:8px 40px 0 40px;">
  <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:32px;line-height:1.2;margin:24px 0 8px 0;">${heading}</h1>
  <p style="font-size:16px;line-height:1.5;color:#555;margin:0 0 24px 0;">${intro}</p>
</td></tr>
<tr><td style="padding:0 40px;">
  <a href="${url}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;font-size:15px;padding:14px 28px;border-radius:999px;">${cta}</a>
</td></tr>
<tr><td style="padding:24px 40px 8px 40px;">
  <p style="font-size:13px;line-height:1.5;color:#888;margin:0;">Werkt de knop niet? Plak deze link in je browser:<br><a href="${url}" style="color:#888;word-break:break-all;">${url}</a></p>
</td></tr>
<tr><td style="padding:24px 40px 32px 40px;">
  <p style="font-size:13px;line-height:1.5;color:#888;margin:0;">Heb je deze mail niet aangevraagd? Negeer 'm dan — er gebeurt niets.</p>
</td></tr>
</table>
<div style="font-size:12px;color:#a8a39d;margin-top:24px;">House of Eve · Den Bosch</div>
</td></tr></table></body></html>`;
}

export async function logout() {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect('/');
}
