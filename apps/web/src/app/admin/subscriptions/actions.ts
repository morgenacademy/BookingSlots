'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

export async function saveSubscription(formData: FormData) {
  const supabase = await getSupabaseServer();
  const id = formData.get('id') ? String(formData.get('id')) : null;
  const credits = formData.get('credits_per_period');
  const row = {
    studio_id: STUDIO_ID,
    name: String(formData.get('name')),
    slug: String(formData.get('slug')),
    price_eur_cents: Math.round(Number(formData.get('price')) * 100),
    interval: String(formData.get('interval')),
    credits_per_period: credits ? Number(credits) : null,
    unlimited: formData.get('unlimited') === 'on',
    credit_rollover: formData.get('credit_rollover') === 'on',
    active: formData.get('active') === 'on',
  };
  if (id) {
    await supabase.from('subscriptions').update(row).eq('id', id);
  } else {
    await supabase.from('subscriptions').insert(row);
  }
  revalidatePath('/admin/subscriptions');
  revalidatePath('/prijzen');
  redirect('/admin/subscriptions');
}

export async function deleteSubscription(formData: FormData) {
  const id = String(formData.get('id'));
  const supabase = await getSupabaseServer();
  await supabase.from('subscriptions').update({ active: false }).eq('id', id);
  revalidatePath('/admin/subscriptions');
  revalidatePath('/prijzen');
  redirect('/admin/subscriptions');
}
