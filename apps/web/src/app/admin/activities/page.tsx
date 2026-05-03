import Link from 'next/link';
import { getSupabaseServer } from '@/lib/supabase/server';
import { saveActivity, deleteActivity } from './actions';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

export default async function ActivitiesAdmin({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await getSupabaseServer();
  const { data: items } = await supabase
    .from('activities')
    .select('*')
    .eq('studio_id', STUDIO_ID)
    .order('name');

  const editing = sp.edit ? items?.find((a) => a.id === sp.edit) : sp.new ? null : undefined;

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="font-display text-3xl">Lestypes</h1>
        <Link
          href="/admin/activities?new=1"
          className="hoe-btn-sm"
        >
          + Nieuw lestype
        </Link>
      </header>

      <ul className="border rounded-2xl divide-y">
        {items?.map((a) => (
          <li key={a.id} className="p-4 flex justify-between items-center">
            <div>
              <div className="font-medium">{a.name}</div>
              <div className="text-sm text-gray-600">
                {a.kind} · {a.default_credit_cost} credits · {a.default_duration_minutes} min
              </div>
            </div>
            <div className="flex gap-3 text-sm">
              <Link href={`/admin/activities?edit=${a.id}`} className="underline">Bewerk</Link>
              <form action={deleteActivity}>
                <input type="hidden" name="id" value={a.id} />
                <button className="text-red-700 underline">Verwijder</button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      {editing !== undefined && (
        <section className="border rounded-2xl p-6">
          <h2 className="font-display text-xl mb-4">
            {editing ? `Bewerk: ${editing.name}` : 'Nieuw lestype'}
          </h2>
          <ActivityForm act={editing ?? null} />
        </section>
      )}
    </div>
  );
}

function ActivityForm({ act }: { act: Record<string, unknown> | null }) {
  const v = (k: string) => (act ? String(act[k] ?? '') : '');
  return (
    <form action={saveActivity} className="grid grid-cols-2 gap-4 text-sm">
      {act && <input type="hidden" name="id" value={String(act.id)} />}
      <label className="flex flex-col gap-1">
        Naam<input name="name" required defaultValue={v('name')} className="hoe-input w-full" />
      </label>
      <label className="flex flex-col gap-1">
        Slug<input name="slug" required defaultValue={v('slug')} className="hoe-input w-full" />
      </label>
      <label className="flex flex-col gap-1">
        Type
        <select name="kind" defaultValue={v('kind') || 'group'} className="hoe-input w-full">
          <option value="group">Groepsles</option>
          <option value="appointment">1-op-1 afspraak</option>
          <option value="duo">DUO</option>
          <option value="event">Event</option>
          <option value="vod">Video on demand</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Credits per les
        <input name="default_credit_cost" type="number" required
          defaultValue={v('default_credit_cost') || '1'} className="hoe-input w-full" />
      </label>
      <label className="flex flex-col gap-1">
        Duur (minuten)
        <input name="default_duration_minutes" type="number" required
          defaultValue={v('default_duration_minutes') || '50'} className="hoe-input w-full" />
      </label>
      <div className="col-span-2">
        <button className="hoe-btn-sm">Opslaan</button>
      </div>
    </form>
  );
}
