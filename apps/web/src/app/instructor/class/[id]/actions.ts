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

  const { data: b } = await admin
    .from('bookings')
    .select('user_id, user_pass_id, studio_id')
    .eq('id', bookingId)
    .single();

  await admin.from('bookings').update({ status: 'no_show' }).eq('id', bookingId);

  // Strip and (on the third) charge an unlimited subscriber for skipping.
  if (b?.user_id && b.user_pass_id && b.studio_id) {
    await registerStrikeForNoShow(b.user_id, b.user_pass_id, b.studio_id, admin);
  }

  void STUDIO_ID;
  revalidatePath(`/instructor/class/${classId}`);
  redirect(`/instructor/class/${classId}`);
}

const STRIKE_LIMIT = 3;
const STRIKE_FINE_CENTS = 1500;

async function registerStrikeForNoShow(
  userId: string,
  userPassId: string,
  studioId: string,
  admin: ReturnType<typeof getSupabaseAdmin>,
) {
  const { data: pass } = await admin
    .from('user_passes')
    .select('user_subscription_id')
    .eq('id', userPassId)
    .maybeSingle();
  if (!pass?.user_subscription_id) return;

  const { data: sub } = await admin
    .from('user_subscriptions')
    .select('id, late_cancel_strikes, template:subscriptions(unlimited)')
    .eq('id', pass.user_subscription_id)
    .single();
  if (!sub) return;
  const tmpl = Array.isArray(sub.template) ? sub.template[0] : sub.template;
  if (!tmpl?.unlimited) return;

  const newCount = (sub.late_cancel_strikes ?? 0) + 1;
  await admin
    .from('user_subscriptions')
    .update({ late_cancel_strikes: newCount })
    .eq('id', sub.id);

  if (newCount >= STRIKE_LIMIT) {
    await admin.from('subscription_penalties').insert({
      studio_id: studioId,
      user_subscription_id: sub.id,
      user_id: userId,
      amount_eur_cents: STRIKE_FINE_CENTS,
      reason: `No-show #${newCount}`,
    });
  }
}

export async function unmark(formData: FormData) {
  const bookingId = String(formData.get('booking_id'));
  const classId = await assertCanMark(bookingId);
  const admin = getSupabaseAdmin();
  await admin.from('bookings').update({ status: 'booked' }).eq('id', bookingId);
  revalidatePath(`/instructor/class/${classId}`);
  redirect(`/instructor/class/${classId}`);
}
