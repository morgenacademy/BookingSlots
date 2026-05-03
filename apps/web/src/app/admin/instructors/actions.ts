'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';

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
