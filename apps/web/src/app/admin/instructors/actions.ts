'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

export async function saveInstructor(formData: FormData) {
  const supabase = await getSupabaseServer();
  const id = formData.get('id') ? String(formData.get('id')) : null;
  const row = {
    studio_id: STUDIO_ID,
    display_name: String(formData.get('display_name')),
    bio: (formData.get('bio') as string) || null,
    photo_url: (formData.get('photo_url') as string) || null,
  };
  if (id) await supabase.from('instructors').update(row).eq('id', id);
  else await supabase.from('instructors').insert(row);
  revalidatePath('/admin/instructors');
  revalidatePath('/rooster');
  redirect('/admin/instructors');
}

export async function deleteInstructor(formData: FormData) {
  const id = String(formData.get('id'));
  const supabase = await getSupabaseServer();
  await supabase.from('instructors').delete().eq('id', id);
  revalidatePath('/admin/instructors');
  redirect('/admin/instructors');
}

export async function inviteInstructor(formData: FormData) {
  const id = String(formData.get('id'));
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!id || !email) redirect(`/admin/instructors?edit=${id}&err=email`);

  const admin = getSupabaseAdmin();

  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email);

  if (existing) {
    await admin
      .from('instructors')
      .update({ user_id: existing.id, invite_email: null })
      .eq('id', id);
  } else {
    await admin
      .from('instructors')
      .update({ invite_email: email, user_id: null })
      .eq('id', id);

    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    await admin.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback?next=/instructor` },
    });
  }

  revalidatePath('/admin/instructors');
  redirect('/admin/instructors?invited=1');
}

export async function unlinkInstructor(formData: FormData) {
  const id = String(formData.get('id'));
  const admin = getSupabaseAdmin();
  await admin
    .from('instructors')
    .update({ user_id: null, invite_email: null })
    .eq('id', id);
  revalidatePath('/admin/instructors');
  redirect('/admin/instructors');
}
