'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { sendMail } from '@/lib/mailer';
import { siteUrl } from '@/lib/mollie';

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
      id, user_id, status, credits_used, user_pass_id, class_id,
      class:classes(starts_at, studio_id)
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

  // Fan out waitlist invites for the freed seat.
  await notifyWaitlist(b.class_id, admin);

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

export async function joinWaitlist(formData: FormData) {
  const classId = String(formData.get('class_id'));
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent('/rooster')}`);

  const admin = getSupabaseAdmin();

  const { data: cls } = await admin
    .from('classes')
    .select('id, studio_id, max_waitlist')
    .eq('id', classId)
    .single();
  if (!cls) redirect('/rooster?error=notfound');

  const { data: studio } = await admin
    .from('studios')
    .select('default_max_waitlist')
    .eq('id', cls.studio_id)
    .single();
  const cap = cls.max_waitlist ?? studio?.default_max_waitlist ?? 10;

  const { count: current } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', classId)
    .eq('status', 'waitlisted');
  if ((current ?? 0) >= cap) redirect('/rooster?error=waitlist_full');

  const { error } = await admin.from('bookings').insert({
    studio_id: cls.studio_id,
    user_id: user.id,
    class_id: classId,
    status: 'waitlisted',
    credits_used: 0,
    waitlist_position: (current ?? 0) + 1,
  });
  if (error) redirect('/rooster?error=waitlist');

  revalidatePath('/rooster');
  revalidatePath('/account');
  redirect('/rooster?waitlisted=1');
}

async function notifyWaitlist(classId: string, admin: ReturnType<typeof getSupabaseAdmin>) {
  const { data: cls } = await admin
    .from('classes')
    .select('starts_at, capacity, activity:activities(name)')
    .eq('id', classId)
    .single();
  if (!cls) return;
  const activity = Array.isArray(cls.activity) ? cls.activity[0] : cls.activity;

  const { count: bookedCount } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', classId)
    .eq('status', 'booked');
  if ((bookedCount ?? 0) >= cls.capacity) return; // no seat actually free

  const { data: waiting } = await admin
    .from('bookings')
    .select('id, user_id, profiles:profiles!bookings_user_id_fkey(email, first_name)')
    .eq('class_id', classId)
    .eq('status', 'waitlisted')
    .order('waitlist_position', { ascending: true });
  if (!waiting?.length) return;

  const invitedAt = new Date().toISOString();
  const startsAt = new Date(cls.starts_at).toLocaleString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });

  for (const w of waiting) {
    const token = randomUUID();
    await admin
      .from('bookings')
      .update({ waitlist_invite_token: token, waitlist_invited_at: invitedAt })
      .eq('id', w.id);

    const profile = Array.isArray(w.profiles) ? w.profiles[0] : w.profiles;
    if (!profile?.email) continue;

    const claimUrl = `${siteUrl()}/waitlist/claim?b=${w.id}&t=${token}`;
    await sendMail({
      to: profile.email,
      toName: profile.first_name ?? undefined,
      subject: `Plek vrij voor ${activity?.name ?? 'je les'} — ${startsAt}`,
      html: `
        <p>Hi ${profile.first_name ?? ''},</p>
        <p>Er is een plek vrijgekomen voor <strong>${activity?.name ?? 'je les'}</strong> op
        <strong>${startsAt}</strong>. Wie het eerst klikt, heeft de plek:</p>
        <p><a href="${claimUrl}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:8px">Claim mijn plek</a></p>
        <p>Als de plek al weg is laten we dat weten zodra je klikt.</p>
      `,
    });
  }
}
