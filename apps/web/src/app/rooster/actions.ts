'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function bookClass(formData: FormData) {
  const classId = String(formData.get('class_id'));
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent('/rooster')}`);

  const admin = getSupabaseAdmin();

  const { data: cls } = await admin
    .from('classes')
    .select(`
      id, studio_id, capacity, is_off_peak, starts_at,
      activity:activities(id, default_credit_cost)
    `)
    .eq('id', classId)
    .single();
  if (!cls) redirect('/rooster?error=notfound');

  const activity = Array.isArray(cls.activity) ? cls.activity[0] : cls.activity;
  const cost = activity?.default_credit_cost ?? 1;
  const activityId = activity?.id;

  // Capacity check
  const { count: booked } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', classId)
    .eq('status', 'booked');
  if ((booked ?? 0) >= cls.capacity) {
    redirect('/rooster?error=full');
  }

  // Find an active pass with enough credits, validity, off-peak match, allowed activity
  const nowIso = new Date().toISOString();
  const { data: passes } = await admin
    .from('user_passes')
    .select(`
      id, credits_remaining, expires_at,
      pass:passes(id, off_peak_only, allowed_activity_ids)
    `)
    .eq('user_id', user.id)
    .gt('credits_remaining', cost - 1)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order('expires_at', { ascending: true });

  const usable = (passes ?? []).find((up) => {
    const p = Array.isArray(up.pass) ? up.pass[0] : up.pass;
    if (!p) return false;
    if (p.off_peak_only && !cls.is_off_peak) return false;
    if (
      activityId &&
      Array.isArray(p.allowed_activity_ids) &&
      p.allowed_activity_ids.length > 0 &&
      !p.allowed_activity_ids.includes(activityId)
    ) {
      return false;
    }
    return true;
  });

  if (!usable) redirect('/rooster?error=no_credits');

  const { error: bookErr } = await admin.from('bookings').insert({
    studio_id: cls.studio_id,
    user_id: user.id,
    class_id: classId,
    user_pass_id: usable.id,
    status: 'booked',
    credits_used: cost,
  });
  if (bookErr) redirect('/rooster?error=book');

  await admin
    .from('user_passes')
    .update({ credits_remaining: usable.credits_remaining - cost })
    .eq('id', usable.id);

  revalidatePath('/rooster');
  revalidatePath('/account');
  redirect('/rooster?booked=1');
}

export async function cancelBooking(formData: FormData) {
  const bookingId = String(formData.get('booking_id'));
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = getSupabaseAdmin();

  const { data: b } = await admin
    .from('bookings')
    .select(`
      id, user_id, status, credits_used, user_pass_id,
      class:classes(starts_at, studio_id),
      class_studio:classes(studio_id)
    `)
    .eq('id', bookingId)
    .single();
  if (!b || b.user_id !== user.id || b.status !== 'booked') redirect('/account');

  const cls = Array.isArray(b.class) ? b.class[0] : b.class;
  const studio_id = cls?.studio_id;
  const { data: studio } = await admin
    .from('studios')
    .select('cancel_deadline_minutes')
    .eq('id', studio_id)
    .single();

  const startsAt = new Date(cls!.starts_at).getTime();
  const deadlineMs = (studio?.cancel_deadline_minutes ?? 360) * 60 * 1000;
  const inTime = startsAt - Date.now() > deadlineMs;

  await admin
    .from('bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', bookingId);

  if (inTime && b.user_pass_id) {
    const { data: up } = await admin
      .from('user_passes')
      .select('credits_remaining')
      .eq('id', b.user_pass_id)
      .single();
    if (up) {
      await admin
        .from('user_passes')
        .update({ credits_remaining: up.credits_remaining + b.credits_used })
        .eq('id', b.user_pass_id);
    }
  }

  revalidatePath('/account');
  revalidatePath('/rooster');
  redirect('/account');
}
