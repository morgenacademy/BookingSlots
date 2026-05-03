import Link from 'next/link';
import { getSupabaseServer } from '@/lib/supabase/server';
import { saveInstructor, deleteInstructor } from './actions';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

export default async function InstructorsAdmin({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await getSupabaseServer();
  const { data: items } = await supabase
    .from('instructors')
    .select('*')
    .eq('studio_id', STUDIO_ID)
    .order('display_name');

  const editing = sp.edit ? items?.find((i) => i.id === sp.edit) : sp.new ? null : undefined;

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="font-display text-3xl">Instructeurs</h1>
        <Link
          href="/admin/instructors?new=1"
          className="hoe-btn-sm"
        >
          + Nieuwe instructeur
        </Link>
      </header>

      <ul className="border rounded-2xl divide-y">
        {items?.map((i) => (
          <li key={i.id} className="p-4 flex justify-between items-center">
            <div>
              <div className="font-medium">{i.display_name}</div>
              {i.bio && <div className="text-sm text-gray-600 line-clamp-1">{i.bio}</div>}
            </div>
            <div className="flex gap-3 text-sm">
              <Link href={`/admin/instructors?edit=${i.id}`} className="underline">Bewerk</Link>
              <form action={deleteInstructor}>
                <input type="hidden" name="id" value={i.id} />
                <button className="text-red-700 underline">Verwijder</button>
              </form>
            </div>
          </li>
        ))}
        {(!items || items.length === 0) && (
          <li className="p-6 text-gray-500 text-sm">Nog geen instructeurs.</li>
        )}
      </ul>

      {editing !== undefined && (
        <section className="border rounded-2xl p-6">
          <h2 className="font-display text-xl mb-4">
            {editing ? `Bewerk: ${editing.display_name}` : 'Nieuwe instructeur'}
          </h2>
          <InstructorForm ins={editing ?? null} />
        </section>
      )}
    </div>
  );
}

function InstructorForm({ ins }: { ins: Record<string, unknown> | null }) {
  const v = (k: string) => (ins ? String(ins[k] ?? '') : '');
  return (
    <form action={saveInstructor} className="grid grid-cols-2 gap-4 text-sm">
      {ins && <input type="hidden" name="id" value={String(ins.id)} />}
      <label className="flex flex-col gap-1 col-span-2">
        Naam
        <input name="display_name" required defaultValue={v('display_name')}
          className="hoe-input w-full" />
      </label>
      <label className="flex flex-col gap-1 col-span-2">
        Bio
        <textarea name="bio" rows={3} defaultValue={v('bio')}
          className="hoe-input w-full" />
      </label>
      <label className="flex flex-col gap-1 col-span-2">
        Foto-URL
        <input name="photo_url" type="url" defaultValue={v('photo_url')}
          className="hoe-input w-full" />
      </label>
      <div className="col-span-2">
        <button className="hoe-btn-sm">Opslaan</button>
      </div>
    </form>
  );
}
