'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

export async function savePass(formData: FormData) {
  const supabase = await getSupabaseServer();

  const id = formData.get('id') ? String(formData.get('id')) : null;
  const row = {
    studio_id: STUDIO_ID,
    name: String(formData.get('name')),
    slug: String(formData.get('slug')),
    price_eur_cents: Math.round(Number(formData.get('price')) * 100),
    credits: Number(formData.get('credits')),
    validity_days: Number(formData.get('validity_days')),
    off_peak_only: formData.get('off_peak_only') === 'on',
    activate_on_first_attendance: formData.get('activate_on_first_attendance') === 'on',
    active: formData.get('active') === 'on',
    description: String(formData.get('description') ?? '') || null,
  };

  if (id) {
    await supabase.from('passes').update(row).eq('id', id);
  } else {
    await supabase.from('passes').insert(row);
  }
  revalidatePath('/admin/passes');
  revalidatePath('/prijzen');
  redirect('/admin/passes');
}

export async function deletePass(formData: FormData) {
  const id = String(formData.get('id'));
  const supabase = await getSupabaseServer();
  // Soft-disable instead of hard-delete so historical orders stay valid.
  await supabase.from('passes').update({ active: false }).eq('id', id);
  revalidatePath('/admin/passes');
  revalidatePath('/prijzen');
  redirect('/admin/passes');
}
