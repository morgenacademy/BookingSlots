'use server';

import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const next = String(formData.get('next') ?? '/account');
  if (!email) return;

  const supabase = await getSupabaseServer();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  redirect('/login?sent=1');
}

export async function logout() {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect('/');
}
