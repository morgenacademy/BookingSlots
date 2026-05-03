import Link from 'next/link';
import { getSupabaseServer } from '@/lib/supabase/server';
import { saveSubscription, deleteSubscription } from './actions';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;
const eur = (c: number) => `€ ${(c / 100).toFixed(2).replace('.', ',')}`;

export default async function SubsAdmin({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await getSupabaseServer();
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('studio_id', STUDIO_ID)
    .order('price_eur_cents');

  const editing = sp.edit ? subs?.find((s) => s.id === sp.edit) : sp.new ? null : undefined;

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="font-display text-3xl">Abonnementen</h1>
        <Link
          href="/admin/subscriptions?new=1"
          className="hoe-btn-sm"
        >
          + Nieuw abonnement
        </Link>
      </header>

      <ul className="border rounded-2xl divide-y">
        {subs?.map((s) => (
          <li key={s.id} className="p-4 flex justify-between items-center">
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-sm text-gray-600">
                {eur(s.price_eur_cents)} / {s.interval} ·{' '}
                {s.unlimited ? 'unlimited' : `${s.credits_per_period} credits`}
                {s.credit_rollover && ' · rollover'}
                {!s.active && ' · inactief'}
              </div>
            </div>
            <div className="flex gap-3 text-sm">
              <Link href={`/admin/subscriptions?edit=${s.id}`} className="underline">Bewerk</Link>
              <form action={deleteSubscription}>
                <input type="hidden" name="id" value={s.id} />
                <button className="text-red-700 underline">Verwijder</button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      {editing !== undefined && (
        <section className="border rounded-2xl p-6">
          <h2 className="font-display text-xl mb-4">
            {editing ? `Bewerk: ${editing.name}` : 'Nieuw abonnement'}
          </h2>
          <SubForm sub={editing ?? null} />
        </section>
      )}
    </div>
  );
}

function SubForm({ sub }: { sub: Record<string, unknown> | null }) {
  const v = (k: string) => (sub ? String(sub[k] ?? '') : '');
  const cents = sub ? Number(sub.price_eur_cents) / 100 : '';
  return (
    <form action={saveSubscription} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
      {sub && <input type="hidden" name="id" value={String(sub.id)} />}
      <label className="flex flex-col gap-1">
        Naam<input name="name" required defaultValue={v('name')} className="hoe-input w-full" />
      </label>
      <label className="flex flex-col gap-1">
        Slug<input name="slug" required defaultValue={v('slug')} className="hoe-input w-full" />
      </label>
      <label className="flex flex-col gap-1">
        Prijs (€)
        <input name="price" type="number" step="0.01" required defaultValue={String(cents)}
          className="hoe-input w-full" />
      </label>
      <label className="flex flex-col gap-1">
        Interval
        <select name="interval" defaultValue={v('interval') || 'month'} className="hoe-input w-full">
          <option value="week">Week</option>
          <option value="month">Maand</option>
          <option value="year">Jaar</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Credits/periode (leeg = unlimited)
        <input name="credits_per_period" type="number" defaultValue={v('credits_per_period')}
          className="hoe-input w-full" />
      </label>
      <label className="flex items-center gap-2 mt-6">
        <input type="checkbox" name="unlimited" defaultChecked={Boolean(sub?.unlimited)} />
        Unlimited
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="credit_rollover" defaultChecked={Boolean(sub?.credit_rollover)} />
        Credits doorschuiven
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="active" defaultChecked={sub ? Boolean(sub.active) : true} />
        Actief
      </label>
      <div className="col-span-2">
        <button className="hoe-btn-sm">Opslaan</button>
      </div>
    </form>
  );
}
