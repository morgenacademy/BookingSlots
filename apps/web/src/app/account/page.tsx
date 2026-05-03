import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Nav } from '@/components/nav';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fmtDate, fmtDateTime } from '@/lib/date';
import { cancelBooking } from '@/app/rooster/actions';

const eur = (cents: number) => `€ ${(cents / 100).toFixed(2).replace('.', ',')}`;

export default async function AccountPage() {
  const t = await getTranslations('account');
  const locale = await getLocale();
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/account');

  const [{ data: profile }, { data: bookings }, { data: passes }, { data: orders }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase
        .from('bookings')
        .select(`
          id, status, credits_used,
          class:classes(starts_at, ends_at, activity:activities(name))
        `)
        .eq('user_id', user.id)
        .in('status', ['booked', 'attended', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('user_passes')
        .select(`
          id, credits_remaining, expires_at,
          pass:passes(name)
        `)
        .eq('user_id', user.id)
        .gt('credits_remaining', 0)
        .order('expires_at', { ascending: true }),
      supabase
        .from('orders')
        .select('id, total_eur_cents, status, paid_at, invoice_number')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-12 space-y-12">
        <header className="flex justify-between items-baseline">
          <h1 className="font-display text-4xl">{t('title')}</h1>
          <p className="text-sm">
            {t('wallet')}: <strong>{eur(profile?.wallet_eur_cents ?? 0)}</strong>
          </p>
        </header>

        <section>
          <h2 className="font-display text-2xl mb-3">{t('passes')}</h2>
          {passes && passes.length > 0 ? (
            <ul className="border border-hoe-line rounded-3xl divide-y bg-white">
              {passes.map((up) => {
                const p = Array.isArray(up.pass) ? up.pass[0] : up.pass;
                return (
                  <li key={up.id} className="p-4 flex justify-between">
                    <span>{p?.name}</span>
                    <span className="text-sm text-gray-600">
                      {t('creditsRemaining', { n: up.credits_remaining })}
                      {up.expires_at &&
                        ` · ${t('expires', { date: fmtDate(up.expires_at, locale) })}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-gray-500">{t('noPasses')}</p>
          )}
        </section>

        <section>
          <h2 className="font-display text-2xl mb-3">{t('bookings')}</h2>
          {bookings && bookings.length > 0 ? (
            <ul className="border border-hoe-line rounded-3xl divide-y bg-white">
              {bookings.map((b) => {
                const cls = Array.isArray(b.class) ? b.class[0] : b.class;
                const a = cls && (Array.isArray(cls.activity) ? cls.activity[0] : cls.activity);
                return (
                  <li key={b.id} className="p-4 flex justify-between items-center">
                    <div>
                      <div className="font-medium">{a?.name}</div>
                      <div className="text-sm text-gray-600">
                        {cls && fmtDateTime(cls.starts_at, locale)} · {b.status}
                      </div>
                    </div>
                    {b.status === 'booked' && (
                      <form action={cancelBooking}>
                        <input type="hidden" name="booking_id" value={b.id} />
                        <button className="text-sm underline">Annuleren</button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-gray-500">{t('noBookings')}</p>
          )}
        </section>

        <section>
          <h2 className="font-display text-2xl mb-3">{t('invoices')}</h2>
          {orders && orders.length > 0 ? (
            <ul className="border border-hoe-line rounded-3xl divide-y bg-white text-sm">
              {orders.map((o) => (
                <li key={o.id} className="p-4 flex justify-between">
                  <span>
                    {o.invoice_number ?? o.id.slice(0, 8)} · {o.status}
                    {o.paid_at && ` · ${fmtDate(o.paid_at, locale)}`}
                  </span>
                  <span>{eur(o.total_eur_cents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">—</p>
          )}
        </section>
      </main>
    </>
  );
}
