'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

export async function saveRoom(formData: FormData) {
  const supabase = await getSupabaseServer();
  const id = formData.get('id') ? String(formData.get('id')) : null;
  const row = {
    studio_id: STUDIO_ID,
    name: String(formData.get('name')),
    capacity: Number(formData.get('capacity')),
  };
  if (id) await supabase.from('rooms').update(row).eq('id', id);
  else await supabase.from('rooms').insert(row);
  revalidatePath('/admin/rooms');
  redirect('/admin/rooms');
}

export async function deleteRoom(formData: FormData) {
  const id = String(formData.get('id'));
  const supabase = await getSupabaseServer();
  await supabase.from('rooms').delete().eq('id', id);
  revalidatePath('/admin/rooms');
  redirect('/admin/rooms');
}
