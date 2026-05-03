'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

export async function saveClass(formData: FormData) {
  const supabase = await getSupabaseServer();
  const id = formData.get('id') ? String(formData.get('id')) : null;
  const row = {
    studio_id: STUDIO_ID,
    activity_id: String(formData.get('activity_id')),
    instructor_id: (formData.get('instructor_id') as string) || null,
    room_id: (formData.get('room_id') as string) || null,
    capacity: Number(formData.get('capacity')),
    starts_at: new Date(String(formData.get('starts_at'))).toISOString(),
    ends_at: new Date(String(formData.get('ends_at'))).toISOString(),
    is_off_peak: formData.get('is_off_peak') === 'on',
    max_waitlist: formData.get('max_waitlist')
      ? Number(formData.get('max_waitlist'))
      : null,
  };
  if (id) await supabase.from('classes').update(row).eq('id', id);
  else await supabase.from('classes').insert(row);
  revalidatePath('/admin/classes');
  revalidatePath('/rooster');
  redirect('/admin/classes');
}

export async function deleteClass(formData: FormData) {
  const id = String(formData.get('id'));
  const supabase = await getSupabaseServer();
  await supabase.from('classes').update({ status: 'cancelled' }).eq('id', id);
  revalidatePath('/admin/classes');
  revalidatePath('/rooster');
  redirect('/admin/classes');
}
