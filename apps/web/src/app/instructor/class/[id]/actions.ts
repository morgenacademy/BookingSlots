'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

async function assertCanMark(bookingId: string) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: b } = await supabase
    .from('bookings')
    .select('id, class_id, class:classes(instructor_id, studio_id)')
    .eq('id', bookingId)
    .single();
  if (!b) redirect('/instructor');

  const cls = Array.isArray(b.class) ? b.class[0] : b.class;
  const [{ count: instr }, { count: adm }] = await Promise.all([
    supabase
      .from('instructors')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('id', cls!.instructor_id),
    supabase
      .from('studio_admins')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('studio_id', cls!.studio_id),
  ]);
  if (!instr && !adm) redirect('/instructor');
  return b.class_id;
}

export async function markAttended(formData: FormData) {
  const bookingId = String(formData.get('booking_id'));
  const classId = await assertCanMark(bookingId);
  const admin = getSupabaseAdmin();
  await admin.from('bookings').update({ status: 'attended' }).eq('id', bookingId);
  revalidatePath(`/instructor/class/${classId}`);
  redirect(`/instructor/class/${classId}`);
}

export async function markNoShow(formData: FormData) {
  const bookingId = String(formData.get('booking_id'));
  const classId = await assertCanMark(bookingId);
  const admin = getSupabaseAdmin();

  // Penalise: pull a credit from the user's active pass for this booking.
  const { data: b } = await admin
    .from('bookings')
    .select('user_pass_id, credits_used, status')
    .eq('id', bookingId)
    .single();
  await admin.from('bookings').update({ status: 'no_show' }).eq('id', bookingId);

  // If the booking was previously booked we already debited the pass at
  // booking time; no extra penalty for now (can be revisited per-studio).
  // We just mark the status.
  void b;

  // Use STUDIO_ID to silence linter if unused elsewhere (keeps single source).
  void STUDIO_ID;
  revalidatePath(`/instructor/class/${classId}`);
  redirect(`/instructor/class/${classId}`);
}

export async function unmark(formData: FormData) {
  const bookingId = String(formData.get('booking_id'));
  const classId = await assertCanMark(bookingId);
  const admin = getSupabaseAdmin();
  await admin.from('bookings').update({ status: 'booked' }).eq('id', bookingId);
  revalidatePath(`/instructor/class/${classId}`);
  redirect(`/instructor/class/${classId}`);
}
