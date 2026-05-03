'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

export async function saveActivity(formData: FormData) {
  const supabase = await getSupabaseServer();
  const id = formData.get('id') ? String(formData.get('id')) : null;
  const row = {
    studio_id: STUDIO_ID,
    name: String(formData.get('name')),
    slug: String(formData.get('slug')),
    kind: String(formData.get('kind')),
    default_credit_cost: Number(formData.get('default_credit_cost')),
    default_duration_minutes: Number(formData.get('default_duration_minutes')),
  };
  if (id) await supabase.from('activities').update(row).eq('id', id);
  else await supabase.from('activities').insert(row);
  revalidatePath('/admin/activities');
  revalidatePath('/rooster');
  redirect('/admin/activities');
}

export async function deleteActivity(formData: FormData) {
  const id = String(formData.get('id'));
  const supabase = await getSupabaseServer();
  await supabase.from('activities').delete().eq('id', id);
  revalidatePath('/admin/activities');
  redirect('/admin/activities');
}
