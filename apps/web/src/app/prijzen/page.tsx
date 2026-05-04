import { getTranslations } from 'next-intl/server';
import { Nav } from '@/components/nav';
import { getSupabaseServer } from '@/lib/supabase/server';
import { addPassToCartAndCheckout, subscribe } from './actions';
import { fmtCredits } from '@/lib/date';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;
const eur = (cents: number) => `€ ${(cents / 100).toFixed(2).replace('.', ',')}`;
const eurNoCents = (cents: number) =>
  cents % 100 === 0 ? `€ ${cents / 100}` : eur(cents);

function pillFor(p: {
  off_peak_only: boolean;
  credits: number;
  price_eur_cents: number;
}) {
  if (p.off_peak_only) return 'Daluren';
  if (p.credits >= 60) return 'Beste waarde';
  if (p.credits >= 30) return 'Populair';
  return `${p.credits} Credits`;
}

export default async function PricingPage() {
  const t = await getTranslations('pricing');
  const supabase = await getSupabaseServer();

  const [{ data: passes }, { data: subs }] = await Promise.all([
    supabase
      .from('passes')
      .select('id, slug, name, description, price_eur_cents, credits, validity_days, off_peak_only')
      .eq('studio_id', STUDIO_ID)
      .eq('active', true)
      .order('price_eur_cents'),
    supabase
      .from('subscriptions')
      .select('id, slug, name, price_eur_cents, credits_per_period, unlimited')
      .eq('studio_id', STUDIO_ID)
      .eq('active', true)
      .order('price_eur_cents'),
  ]);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-16 space-y-20">
        <header className="text-center space-y-4">
          <h1 className="font-display text-5xl">{t('title')}</h1>
          <p className="text-hoe-muted max-w-2xl mx-auto">{t('subtitle')}</p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {passes?.map((p) => {
            const reformerEur = eurNoCents(p.price_eur_cents / p.credits * 3);
            const barreEur = eurNoCents(p.price_eur_cents / p.credits * 2);
            return (
              <article key={p.id} className="hoe-card">
                <div className="hoe-pill self-center">{pillFor(p)}</div>
                <h2 className="font-display text-2xl mt-2">{p.name}</h2>

                <p className="hoe-price">
                  {eurNoCents(p.price_eur_cents)}
                </p>
                <p className="text-sm text-hoe-muted -mt-2">
                  {p.credits} Credits · {t('perCredit', { price: eur(Math.round(p.price_eur_cents / p.credits)) })}
                </p>

                <div className="hoe-callout">
                  <strong>Indicatie:</strong> Reformer {reformerEur} · Barre/Yoga {barreEur}
                </div>

                <ul className="hoe-check space-y-1 text-sm text-hoe-fg/90 mt-1">
                  <li>{p.credits} Credits geldig {p.validity_days} dagen</li>
                  <li>Reformer = 3 Credits</li>
                  <li>Barre/Yoga = 2 Credits</li>
                  {p.off_peak_only && <li>Alleen daluren (07/08/10u, ma-vr)</li>}
                  {!p.off_peak_only && <li>Onbeperkt te boeken</li>}
                </ul>

                <form action={addPassToCartAndCheckout} className="mt-auto pt-3">
                  <input type="hidden" name="pass_id" value={p.id} />
                  <button type="submit" className="hoe-btn-primary">
                    {t('buy', { name: p.name })}
                  </button>
                </form>
              </article>
            );
          })}
        </section>

        {subs && subs.length > 0 && (
          <section className="space-y-10">
            <header className="text-center">
              <h2 className="font-display text-4xl">{t('subscriptions')}</h2>
              <p className="text-hoe-muted mt-2">
                Elke maand nieuwe Credits of onbeperkt boeken — afhankelijk van jouw ritme.
              </p>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {subs.map((s) => (
                <article key={s.id} className="hoe-card">
                  <div className="hoe-pill self-center">
                    {s.unlimited ? 'Onbeperkt boeken' : `${fmtCredits(s.credits_per_period)} Credits / maand`}
                  </div>
                  <h3 className="font-display text-2xl mt-2">{s.name}</h3>
                  <p className="hoe-price">
                    {eurNoCents(s.price_eur_cents)}
                    <small>/ maand</small>
                  </p>
                  <ul className="hoe-check space-y-1 text-sm text-hoe-fg/90 mt-1">
                    {!s.unlimited && (
                      <li>{fmtCredits(s.credits_per_period)} Credits per maand</li>
                    )}
                    <li>Reformer = 3 Credits</li>
                    <li>Barre/Yoga = 2 Credits</li>
                    {s.unlimited && <li>Onbeperkt sessies</li>}
                  </ul>
                  <form action={subscribe} className="mt-auto pt-3">
                    <input type="hidden" name="subscription_id" value={s.id} />
                    <button type="submit" className="hoe-btn-primary">
                      {t('subscribe', { name: s.name })}
                    </button>
                  </form>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
