import Link from 'next/link';
import { getSupabaseServer } from '@/lib/supabase/server';
import { saveRoom, deleteRoom } from './actions';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

export default async function RoomsAdmin({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await getSupabaseServer();
  const { data: items } = await supabase
    .from('rooms')
    .select('*')
    .eq('studio_id', STUDIO_ID)
    .order('name');

  const editing = sp.edit ? items?.find((r) => r.id === sp.edit) : sp.new ? null : undefined;

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="font-display text-3xl">Ruimtes</h1>
        <Link
          href="/admin/rooms?new=1"
          className="hoe-btn-sm"
        >
          + Nieuwe ruimte
        </Link>
      </header>

      <ul className="border rounded-2xl divide-y">
        {items?.map((r) => (
          <li key={r.id} className="p-4 flex justify-between items-center">
            <div>
              <div className="font-medium">{r.name}</div>
              <div className="text-sm text-gray-600">capaciteit {r.capacity}</div>
            </div>
            <div className="flex gap-3 text-sm">
              <Link href={`/admin/rooms?edit=${r.id}`} className="underline">Bewerk</Link>
              <form action={deleteRoom}>
                <input type="hidden" name="id" value={r.id} />
                <button className="text-red-700 underline">Verwijder</button>
              </form>
            </div>
          </li>
        ))}
        {(!items || items.length === 0) && (
          <li className="p-6 text-gray-500 text-sm">Nog geen ruimtes.</li>
        )}
      </ul>

      {editing !== undefined && (
        <section className="border rounded-2xl p-6">
          <h2 className="font-display text-xl mb-4">
            {editing ? `Bewerk: ${editing.name}` : 'Nieuwe ruimte'}
          </h2>
          <RoomForm room={editing ?? null} />
        </section>
      )}
    </div>
  );
}

function RoomForm({ room }: { room: Record<string, unknown> | null }) {
  const v = (k: string) => (room ? String(room[k] ?? '') : '');
  return (
    <form action={saveRoom} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
      {room && <input type="hidden" name="id" value={String(room.id)} />}
      <label className="flex flex-col gap-1">
        Naam
        <input name="name" required defaultValue={v('name')}
          className="hoe-input w-full" />
      </label>
      <label className="flex flex-col gap-1">
        Capaciteit
        <input name="capacity" type="number" required defaultValue={v('capacity') || '12'}
          className="hoe-input w-full" />
      </label>
      <div className="col-span-2">
        <button className="hoe-btn-sm">Opslaan</button>
      </div>
    </form>
  );
}
