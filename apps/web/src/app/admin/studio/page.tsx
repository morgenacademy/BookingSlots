import { getSupabaseServer } from '@/lib/supabase/server';
import { saveStudio } from './actions';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

export default async function StudioSettings({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await getSupabaseServer();
  const { data: studio } = await supabase
    .from('studios')
    .select('*')
    .eq('id', STUDIO_ID)
    .single();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl sm:text-3xl">Studio-instellingen</h1>
        <p className="text-sm text-gray-600 mt-1">
          Geldt voor de hele studio. Per-klas overrides kun je instellen op de klas zelf.
        </p>
      </header>

      {sp.ok && <p className="hoe-callout">Opgeslagen.</p>}

      <form action={saveStudio} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border rounded-2xl p-6">
        <label className="flex flex-col gap-1 sm:col-span-2">
          Naam
          <input name="name" required defaultValue={studio?.name ?? ''} className="hoe-input w-full" />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          Cancel-deadline (minuten vóór lesstart)
          <input name="cancel_deadline_minutes" type="number" min="0" required
            defaultValue={studio?.cancel_deadline_minutes ?? 480}
            className="hoe-input w-full" />
          <span className="text-xs text-gray-500">
            Klanten die binnen deze tijd annuleren krijgen hun credit niet terug.
            8 uur = 480 minuten.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          Max wachtlijst per klas
          <input name="default_max_waitlist" type="number" min="0" required
            defaultValue={studio?.default_max_waitlist ?? 10}
            className="hoe-input w-full" />
          <span className="text-xs text-gray-500">
            Standaardwaarde — kan per klas overschreven worden.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          Factuur-prefix
          <input name="invoice_number_prefix" required
            defaultValue={studio?.invoice_number_prefix ?? 'INV'}
            className="hoe-input w-full" />
          <span className="text-xs text-gray-500">
            Bv. <code>HOE</code> → factuurnummer wordt <code>HOE-2026-00001</code>.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          BTW-nummer
          <input name="vat_number"
            defaultValue={studio?.vat_number ?? ''}
            className="hoe-input w-full" />
        </label>

        <div className="sm:col-span-2">
          <button className="hoe-btn-sm">Opslaan</button>
        </div>
      </form>
    </div>
  );
}
