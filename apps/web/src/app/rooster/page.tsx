import { getLocale, getTranslations } from 'next-intl/server';
import { Nav } from '@/components/nav';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fmtDateTime } from '@/lib/date';
import { bookClass, joinWaitlist } from './actions';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

export default async function RoosterPage() {
  const t = await getTranslations('schedule');
  const locale = await getLocale();
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 14);

  const { data: classes } = await supabase
    .from('classes')
    .select(`
      id, starts_at, ends_at, capacity, is_off_peak, status,
      activity:activities(name, default_credit_cost),
      instructor:instructors(display_name)
    `)
    .eq('studio_id', STUDIO_ID)
    .gte('starts_at', from.toISOString())
    .lte('starts_at', to.toISOString())
    .eq('status', 'scheduled')
    .order('starts_at');

  const myBookings = user
    ? (
        await supabase
          .from('bookings')
          .select('class_id, status')
          .eq('user_id', user.id)
          .in('status', ['booked', 'waitlisted'])
      ).data ?? []
    : [];
  const myStatusByClass = new Map(myBookings.map((b) => [b.class_id, b.status as string]));

  const classIds = (classes ?? []).map((c) => c.id);
  const occupancy = new Map<string, { booked: number; waitlisted: number }>();
  if (classIds.length) {
    const { data: rows } = await supabase
      .from('bookings')
      .select('class_id, status')
      .in('class_id', classIds)
      .in('status', ['booked', 'waitlisted']);
    for (const r of rows ?? []) {
      const o = occupancy.get(r.class_id) ?? { booked: 0, waitlisted: 0 };
      if (r.status === 'booked') o.booked++; else o.waitlisted++;
      occupancy.set(r.class_id, o);
    }
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-4xl mb-8">{t('title')}</h1>

        <ul className="divide-y border border-hoe-line rounded-3xl bg-white">
          {classes?.map((c) => {
            const a = Array.isArray(c.activity) ? c.activity[0] : c.activity;
            const ins = Array.isArray(c.instructor) ? c.instructor[0] : c.instructor;
            const myStatus = myStatusByClass.get(c.id);
            const occ = occupancy.get(c.id) ?? { booked: 0, waitlisted: 0 };
            const isFull = occ.booked >= c.capacity;
            return (
              <li key={c.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium">{a?.name}</div>
                  <div className="text-sm text-gray-600">
                    {fmtDateTime(c.starts_at, locale)} ·{' '}
                    {ins?.display_name} ·{' '}
                    {t('credits', { n: a?.default_credit_cost ?? 0 })}
                    {c.is_off_peak && ' · daluur'}
                    {isFull && ` · vol (${occ.waitlisted} op wachtlijst)`}
                  </div>
                </div>
                {!user ? (
                  <a href="/login" className="text-sm underline">
                    {t('loginToBook')}
                  </a>
                ) : myStatus === 'booked' ? (
                  <span className="text-sm text-green-700">{t('booked')}</span>
                ) : myStatus === 'waitlisted' ? (
                  <span className="text-sm text-amber-700">Op wachtlijst</span>
                ) : isFull ? (
                  <form action={joinWaitlist}>
                    <input type="hidden" name="class_id" value={c.id} />
                    <button type="submit" className="border rounded-full !w-auto px-4 py-1.5 text-sm hover:bg-gray-50">
                      Op wachtlijst
                    </button>
                  </form>
                ) : (
                  <form action={bookClass}>
                    <input type="hidden" name="class_id" value={c.id} />
                    <button
                      type="submit"
                      className="hoe-btn-primary !w-auto px-5 py-1.5 text-sm"
                    >
                      {t('book')}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
          {(!classes || classes.length === 0) && (
            <li className="p-6 text-gray-500 text-sm">Geen klassen gevonden.</li>
          )}
        </ul>
      </main>
    </>
  );
}
