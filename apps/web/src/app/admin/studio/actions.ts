'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

export async function saveStudio(formData: FormData) {
  const admin = getSupabaseAdmin();
  await admin
    .from('studios')
    .update({
      name: String(formData.get('name')),
      cancel_deadline_minutes: Number(formData.get('cancel_deadline_minutes')),
      default_max_waitlist: Number(formData.get('default_max_waitlist')),
      invoice_number_prefix: String(formData.get('invoice_number_prefix')),
      vat_number: (formData.get('vat_number') as string) || null,
    })
    .eq('id', STUDIO_ID);
  revalidatePath('/admin/studio');
  redirect('/admin/studio?ok=1');
}
