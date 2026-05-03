'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

export async function inviteAdmin(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? 'manager');
  if (!email) redirect('/admin/team?err=email');

  const admin = getSupabaseAdmin();

  // If a user with this email already exists, promote directly.
  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email);

  if (existing) {
    await admin
      .from('studio_admins')
      .upsert({ studio_id: STUDIO_ID, user_id: existing.id, role }, { onConflict: 'studio_id,user_id' });
  } else {
    await admin
      .from('studio_admin_invites')
      .upsert({ studio_id: STUDIO_ID, email, role }, { onConflict: 'studio_id,email' });

    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    await admin.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback?next=/admin` },
    });
  }

  revalidatePath('/admin/team');
  redirect('/admin/team?ok=1');
}

export async function removeAdmin(formData: FormData) {
  const userId = String(formData.get('user_id'));
  const supabase = await getSupabaseServer();
  await supabase
    .from('studio_admins')
    .delete()
    .eq('studio_id', STUDIO_ID)
    .eq('user_id', userId);
  revalidatePath('/admin/team');
  redirect('/admin/team');
}

export async function cancelInvite(formData: FormData) {
  const email = String(formData.get('email'));
  const supabase = await getSupabaseServer();
  await supabase
    .from('studio_admin_invites')
    .delete()
    .eq('studio_id', STUDIO_ID)
    .eq('email', email);
  revalidatePath('/admin/team');
  redirect('/admin/team');
}
