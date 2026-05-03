'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;
const PHOTO_BUCKET = 'instructor-photos';

async function uploadPhoto(file: File): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const admin = getSupabaseAdmin();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    console.error('[instructors] photo upload failed', error);
    return null;
  }
  const { data } = admin.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function linkOrInvite(instructorId: string, email: string) {
  if (!email) return;
  const admin = getSupabaseAdmin();
  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email);

  if (existing) {
    // Promote an existing customer (or admin) to instructor by linking
    // their auth user id.
    await admin
      .from('instructors')
      .update({ user_id: existing.id, invite_email: null })
      .eq('id', instructorId);
  } else {
    await admin
      .from('instructors')
      .update({ invite_email: email, user_id: null })
      .eq('id', instructorId);

    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    await admin.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback?next=/instructor` },
    });
  }
}

export async function saveInstructor(formData: FormData) {
  const admin = getSupabaseAdmin();
  const id = formData.get('id') ? String(formData.get('id')) : null;
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const photoFile = formData.get('photo') as File | null;
  const removePhoto = formData.get('remove_photo') === 'on';

  let photoUrl: string | null | undefined = undefined;
  if (photoFile && photoFile.size > 0) photoUrl = await uploadPhoto(photoFile);
  else if (removePhoto) photoUrl = null;

  const row: Record<string, unknown> = {
    studio_id: STUDIO_ID,
    display_name: String(formData.get('display_name')),
    bio: (formData.get('bio') as string) || null,
  };
  if (photoUrl !== undefined) row.photo_url = photoUrl;

  let instructorId = id;
  if (id) {
    await admin.from('instructors').update(row).eq('id', id);
  } else {
    if (!email) redirect('/admin/instructors?new=1&err=email');
    const { data: created } = await admin.from('instructors').insert(row).select('id').single();
    instructorId = created?.id ?? null;
  }

  // Whenever an email is supplied, (re)link or send invite. Skipped for
  // edits where the field is left blank.
  if (instructorId && email) await linkOrInvite(instructorId, email);

  revalidatePath('/admin/instructors');
  revalidatePath('/rooster');
  redirect(email ? '/admin/instructors?invited=1' : '/admin/instructors');
}

export async function deleteInstructor(formData: FormData) {
  const id = String(formData.get('id'));
  const admin = getSupabaseAdmin();
  await admin.from('instructors').delete().eq('id', id);
  revalidatePath('/admin/instructors');
  redirect('/admin/instructors');
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

export async function inviteInstructor(formData: FormData) {
  // Backwards-compat for the standalone invite form on the edit page.
  const id = String(formData.get('id'));
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!id || !email) redirect(`/admin/instructors?edit=${id}&err=email`);
  await linkOrInvite(id, email);
  revalidatePath('/admin/instructors');
  redirect('/admin/instructors?invited=1');
}
