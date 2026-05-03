import Link from 'next/link';
import { getSupabaseServer } from '@/lib/supabase/server';
import { savePass, deletePass } from './actions';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;
const eur = (c: number) => `€ ${(c / 100).toFixed(2).replace('.', ',')}`;

export default async function PassesAdmin({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await getSupabaseServer();
  const { data: passes } = await supabase
    .from('passes')
    .select('*')
    .eq('studio_id', STUDIO_ID)
    .order('price_eur_cents');

  const editing = sp.edit
    ? passes?.find((p) => p.id === sp.edit)
    : sp.new
      ? null // new
      : undefined;

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="font-display text-3xl">Strippenkaarten</h1>
        <Link
          href="/admin/passes?new=1"
          className="hoe-btn-sm"
        >
          + Nieuwe kaart
        </Link>
      </header>

      <ul className="border rounded-2xl divide-y">
        {passes?.map((p) => (
          <li key={p.id} className="p-4 flex justify-between items-center">
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="text-sm text-gray-600">
                {eur(p.price_eur_cents)} · {p.credits} credits · {p.validity_days} dagen
                {p.off_peak_only && ' · daluren'}
                {!p.active && ' · inactief'}
              </div>
            </div>
            <div className="flex gap-3 text-sm">
              <Link href={`/admin/passes?edit=${p.id}`} className="underline">
                Bewerk
              </Link>
              <form action={deletePass}>
                <input type="hidden" name="id" value={p.id} />
                <button className="text-red-700 underline">Verwijder</button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      {editing !== undefined && (
        <section className="border rounded-2xl p-6">
          <h2 className="font-display text-xl mb-4">
            {editing ? `Bewerk: ${editing.name}` : 'Nieuwe strippenkaart'}
          </h2>
          <PassForm pass={editing ?? null} />
        </section>
      )}
    </div>
  );
}

function PassForm({ pass }: { pass: Record<string, unknown> | null }) {
  const v = (k: string) => (pass ? String(pass[k] ?? '') : '');
  const cents = pass ? Number(pass.price_eur_cents) / 100 : '';
  return (
    <form action={savePass} className="grid grid-cols-2 gap-4 text-sm">
      {pass && <input type="hidden" name="id" value={String(pass.id)} />}
      <label className="flex flex-col gap-1">
        Naam
        <input name="name" required defaultValue={v('name')} className="hoe-input w-full" />
      </label>
      <label className="flex flex-col gap-1">
        Slug
        <input name="slug" required defaultValue={v('slug')} className="hoe-input w-full" />
      </label>
      <label className="flex flex-col gap-1">
        Prijs (€)
        <input name="price" type="number" step="0.01" required defaultValue={String(cents)}
          className="hoe-input w-full" />
      </label>
      <label className="flex flex-col gap-1">
        Credits
        <input name="credits" type="number" required defaultValue={v('credits')}
          className="hoe-input w-full" />
      </label>
      <label className="flex flex-col gap-1">
        Geldig (dagen)
        <input name="validity_days" type="number" required defaultValue={v('validity_days')}
          className="hoe-input w-full" />
      </label>
      <label className="flex items-center gap-2 mt-6">
        <input
          type="checkbox"
          name="off_peak_only"
          defaultChecked={Boolean(pass?.off_peak_only)}
        />
        Alleen daluren
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="activate_on_first_attendance"
          defaultChecked={Boolean(pass?.activate_on_first_attendance)}
        />
        Activeren bij eerste les
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="active" defaultChecked={pass ? Boolean(pass.active) : true} />
        Actief
      </label>
      <label className="flex flex-col gap-1 col-span-2">
        Beschrijving
        <textarea name="description" defaultValue={v('description')} className="hoe-input w-full" />
      </label>
      <div className="col-span-2">
        <button className="hoe-btn-sm">
          Opslaan
        </button>
      </div>
    </form>
  );
}
