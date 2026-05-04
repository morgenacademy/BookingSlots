import Link from 'next/link';
import { Nav } from '@/components/nav';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getSupabaseServer } from '@/lib/supabase/server';

type Result = 'claimed' | 'too_late' | 'invalid' | 'no_credits' | 'login_required';

async function claim(bookingId: string, token: string): Promise<Result> {
  const admin = getSupabaseAdmin();
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'login_required';

  const { data: booking } = await admin
    .from('bookings')
    .select(`
      id, user_id, class_id, status, waitlist_invite_token,
      class:classes(
        id, studio_id, capacity, is_off_peak,
        activity:activities(id, default_credit_cost)
      )
    `)
    .eq('id', bookingId)
    .single();

  if (!booking || booking.user_id !== user.id) return 'invalid';
  if (booking.waitlist_invite_token !== token) return 'invalid';
  if (booking.status === 'booked') return 'claimed';
  if (booking.status !== 'waitlisted') return 'too_late';

  const cls = Array.isArray(booking.class) ? booking.class[0] : booking.class;
  if (!cls) return 'invalid';
  const activity = Array.isArray(cls.activity) ? cls.activity[0] : cls.activity;
  const cost = activity?.default_credit_cost ?? 1;

  // Atomic claim: only flip from 'waitlisted' to 'booked' if a seat is still
  // free. We do an optimistic-style check then conditional update.
  const { count: booked } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', cls.id)
    .eq('status', 'booked');
  if ((booked ?? 0) >= cls.capacity) return 'too_late';

  // Find usable pass.
  const nowIso = new Date().toISOString();
  const { data: passes } = await admin
    .from('user_passes')
    .select('id, credits_remaining, expires_at, pass:passes(off_peak_only, allowed_activity_ids)')
    .eq('user_id', user.id)
    .gte('credits_remaining', cost)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order('expires_at', { ascending: true });

  const usable = (passes ?? []).find((up) => {
    const p = Array.isArray(up.pass) ? up.pass[0] : up.pass;
    if (!p) return false;
    if (p.off_peak_only && !cls.is_off_peak) return false;
    if (
      activity?.id &&
      Array.isArray(p.allowed_activity_ids) &&
      p.allowed_activity_ids.length > 0 &&
      !p.allowed_activity_ids.includes(activity.id)
    ) return false;
    return true;
  });
  if (!usable) return 'no_credits';

  // Race-safe flip: only update if still waitlisted with matching token.
  const { data: flipped } = await admin
    .from('bookings')
    .update({
      status: 'booked',
      user_pass_id: usable.id,
      credits_used: cost,
      waitlist_claimed_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .eq('status', 'waitlisted')
    .eq('waitlist_invite_token', token)
    .select('id')
    .single();

  if (!flipped) return 'too_late';

  await admin
    .from('user_passes')
    .update({ credits_remaining: usable.credits_remaining - cost })
    .eq('id', usable.id);

  return 'claimed';
}

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string; t?: string }>;
}) {
  const sp = await searchParams;
  let result: Result = 'invalid';
  if (sp.b && sp.t) result = await claim(sp.b, sp.t);

  const messages: Record<Result, { title: string; body: string }> = {
    claimed:        { title: 'Plek geclaimd!', body: 'Je staat ingeschreven voor de les. Tot zo!' },
    too_late:       { title: 'Helaas — net te laat', body: 'Iemand anders was eerder. Je staat nog op de wachtlijst voor een volgende vrijgekomen plek.' },
    invalid:        { title: 'Ongeldige link', body: 'Deze claim-link werkt niet meer.' },
    no_credits:     { title: 'Geen geldige strippenkaart', body: 'Koop of verleng eerst een strippenkaart, dan kun je opnieuw boeken.' },
    login_required: { title: 'Log eerst in', body: 'Open dezelfde link na inloggen om je plek te claimen.' },
  };
  const m = messages[result];

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-md px-6 py-16 text-center space-y-4">
        <h1 className="font-display text-3xl">{m.title}</h1>
        <p className="text-gray-600">{m.body}</p>
        <Link href="/account" className="inline-block hoe-btn-primary !w-auto px-5 py-2">
          Naar mijn account
        </Link>
      </main>
    </>
  );
}
