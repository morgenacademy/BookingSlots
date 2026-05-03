'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

async function findUserByEmail(email: string) {
  const admin = getSupabaseAdmin();
  const { data: list } = await admin.auth.admin.listUsers();
  return list?.users.find((u) => u.email?.toLowerCase() === email);
}

async function sendInviteMail(email: string, next: string) {
  const admin = getSupabaseAdmin();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  await admin.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
}

export async function inviteTeamMember(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? 'admin');
  const displayName = String(formData.get('display_name') ?? '').trim();

  if (!email) redirect('/admin/team?err=email');
  if (role === 'instructor' && !displayName) redirect('/admin/team?err=name');

  const admin = getSupabaseAdmin();
  const existing = await findUserByEmail(email);

  if (role === 'admin') {
    if (existing) {
      await admin.from('studio_admins').upsert(
        { studio_id: STUDIO_ID, user_id: existing.id, role: 'manager' },
        { onConflict: 'studio_id,user_id' },
      );
    } else {
      await admin.from('studio_admin_invites').upsert(
        { studio_id: STUDIO_ID, email, role: 'manager' },
        { onConflict: 'studio_id,email' },
      );
      await sendInviteMail(email, '/admin');
    }
  } else {
    // instructor — create the instructors row and link or invite the user.
    const { data: created } = await admin
      .from('instructors')
      .insert({ studio_id: STUDIO_ID, display_name: displayName })
      .select('id')
      .single();
    if (!created) redirect('/admin/team?err=create');

    if (existing) {
      await admin
        .from('instructors')
        .update({ user_id: existing.id, invite_email: null })
        .eq('id', created.id);
    } else {
      await admin
        .from('instructors')
        .update({ invite_email: email })
        .eq('id', created.id);
      await sendInviteMail(email, '/instructor');
    }
  }

  revalidatePath('/admin/team');
  revalidatePath('/admin/instructors');
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

// Backwards-compat aliases — the old form posted to inviteAdmin.
export const inviteAdmin = inviteTeamMember;
