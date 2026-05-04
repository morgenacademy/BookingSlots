import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Nav } from '@/components/nav';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fmtDate, fmtDateTime } from '@/lib/date';
import { cancelBooking } from '@/app/rooster/actions';
import { payPenalty } from './actions';

const eur = (cents: number) => `€ ${(cents / 100).toFixed(2).replace('.', ',')}`;

export default async function AccountPage() {
  const t = await getTranslations('account');
  const locale = await getLocale();
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/account');

  const [{ data: profile }, { data: bookings }, { data: passes }, { data: orders }, { data: penalties }, { data: subs }] =
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
      supabase
        .from('subscription_penalties')
        .select('id, amount_eur_cents, reason, status, created_at')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false }),
      supabase
        .from('user_subscriptions')
        .select('id, late_cancel_strikes, status, subscription:subscriptions(name, unlimited)')
        .eq('user_id', user.id)
        .eq('status', 'active'),
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

        {(penalties && penalties.length > 0) && (
          <section className="border border-red-200 bg-red-50 rounded-3xl p-5 space-y-3">
            <h2 className="font-display text-lg">Openstaande boetes</h2>
            <ul className="text-sm divide-y divide-red-200">
              {penalties.map((p) => (
                <li key={p.id} className="py-2 flex justify-between items-center gap-3">
                  <div>
                    <div>{p.reason}</div>
                    <div className="text-xs text-red-700/80">{fmtDate(p.created_at, locale)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <strong>{eur(p.amount_eur_cents)}</strong>
                    <form action={payPenalty}>
                      <input type="hidden" name="penalty_id" value={p.id} />
                      <button className="hoe-btn-sm">Betaal</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {subs?.some((s) => {
          const tmpl = Array.isArray(s.subscription) ? s.subscription[0] : s.subscription;
          return tmpl?.unlimited && (s.late_cancel_strikes ?? 0) > 0 && (s.late_cancel_strikes ?? 0) < 3;
        }) && (
          <section className="border border-amber-200 bg-amber-50 rounded-3xl p-5 text-sm">
            <h2 className="font-display text-lg mb-1">Waarschuwing late annulering</h2>
            <p>
              Je hebt {subs?.find((s) => {
                const t = Array.isArray(s.subscription) ? s.subscription[0] : s.subscription;
                return t?.unlimited;
              })?.late_cancel_strikes} van 3 strikes voor late annulering of no-show op je
              unlimited-abonnement. Bij de derde strike volgt €&nbsp;15 boete.
            </p>
          </section>
        )}

        <section>
          <div className="flex justify-between items-baseline mb-3">
            <h2 className="font-display text-2xl">{t('passes')}</h2>
            <Link href="/prijzen" className="text-sm underline hover:no-underline">
              {passes && passes.length > 0 ? 'Verleng of vul aan →' : 'Bekijk prijzen →'}
            </Link>
          </div>
          {passes && passes.length > 0 ? (
            <ul className="border border-hoe-line rounded-3xl divide-y bg-white">
              {passes.map((up) => {
                const p = Array.isArray(up.pass) ? up.pass[0] : up.pass;
                const lowCredits = up.credits_remaining <= 2;
                const expiresSoon = up.expires_at &&
                  new Date(up.expires_at).getTime() - Date.now() < 14 * 86400000;
                return (
                  <li key={up.id} className="p-4 flex justify-between items-center gap-4">
                    <span>{p?.name}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm ${lowCredits || expiresSoon ? 'text-amber-700' : 'text-gray-600'}`}>
                        {t('creditsRemaining', { n: up.credits_remaining })}
                        {up.expires_at &&
                          ` · ${t('expires', { date: fmtDate(up.expires_at, locale) })}`}
                      </span>
                      {(lowCredits || expiresSoon) && (
                        <Link href="/prijzen" className="hoe-btn-sm-ghost">
                          Vul aan
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="border border-hoe-line border-dashed rounded-3xl p-8 bg-white text-center space-y-3">
              <p className="text-gray-500">{t('noPasses')}</p>
              <Link href="/prijzen" className="hoe-btn-sm">
                Koop een strippenkaart
              </Link>
            </div>
          )}
        </section>

        <section>
          <div className="flex justify-between items-baseline mb-3">
            <h2 className="font-display text-2xl">{t('bookings')}</h2>
            <Link href="/rooster" className="text-sm underline hover:no-underline">
              Naar rooster →
            </Link>
          </div>
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
            <div className="border border-hoe-line border-dashed rounded-3xl p-8 bg-white text-center space-y-3">
              <p className="text-gray-500">{t('noBookings')}</p>
              <Link href="/rooster" className="hoe-btn-sm">
                Boek een les
              </Link>
            </div>
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
