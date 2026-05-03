import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fmtDateTime } from '@/lib/date';
import { saveClass, deleteClass } from './actions';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

export default async function ClassesAdmin({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const supabase = await getSupabaseServer();

  const [{ data: classes }, { data: activities }, { data: instructors }, { data: rooms }] =
    await Promise.all([
      supabase
        .from('classes')
        .select('*, activity:activities(name), instructor:instructors(display_name)')
        .eq('studio_id', STUDIO_ID)
        .gte('starts_at', new Date(Date.now() - 86400000).toISOString())
        .order('starts_at')
        .limit(100),
      supabase.from('activities').select('id, name').eq('studio_id', STUDIO_ID),
      supabase.from('instructors').select('id, display_name').eq('studio_id', STUDIO_ID),
      supabase.from('rooms').select('id, name').eq('studio_id', STUDIO_ID),
    ]);

  const editing = sp.edit ? classes?.find((c) => c.id === sp.edit) : sp.new ? null : undefined;

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="font-display text-3xl">Rooster</h1>
        <Link
          href="/admin/classes?new=1"
          className="hoe-btn-sm"
        >
          + Nieuwe klas
        </Link>
      </header>

      <ul className="border rounded-2xl divide-y">
        {classes?.map((c) => {
          const a = Array.isArray(c.activity) ? c.activity[0] : c.activity;
          const i = Array.isArray(c.instructor) ? c.instructor[0] : c.instructor;
          return (
            <li key={c.id} className="p-4 flex justify-between items-center">
              <div>
                <div className="font-medium">
                  {a?.name} · {fmtDateTime(c.starts_at, locale)}
                </div>
                <div className="text-sm text-gray-600">
                  {i?.display_name ?? '—'} · cap {c.capacity}
                  {c.is_off_peak && ' · daluur'} · {c.status}
                </div>
              </div>
              <div className="flex gap-3 text-sm">
                <Link href={`/admin/classes?edit=${c.id}`} className="underline">Bewerk</Link>
                <form action={deleteClass}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="text-red-700 underline">Verwijder</button>
                </form>
              </div>
            </li>
          );
        })}
        {(!classes || classes.length === 0) && (
          <li className="p-6 text-gray-500 text-sm">Nog geen klassen.</li>
        )}
      </ul>

      {editing !== undefined && (
        <section className="border rounded-2xl p-6">
          <h2 className="font-display text-xl mb-4">
            {editing ? 'Bewerk klas' : 'Nieuwe klas'}
          </h2>
          <ClassForm
            cls={editing ?? null}
            activities={activities ?? []}
            instructors={instructors ?? []}
            rooms={rooms ?? []}
          />
        </section>
      )}
    </div>
  );
}

type Opt = { id: string; name?: string; display_name?: string };

function ClassForm({
  cls,
  activities,
  instructors,
  rooms,
}: {
  cls: Record<string, unknown> | null;
  activities: Opt[];
  instructors: Opt[];
  rooms: Opt[];
}) {
  const v = (k: string) => (cls ? String(cls[k] ?? '') : '');
  const dt = (k: string) => {
    if (!cls?.[k]) return '';
    const d = new Date(String(cls[k]));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return (
    <form action={saveClass} className="grid grid-cols-2 gap-4 text-sm">
      {cls && <input type="hidden" name="id" value={String(cls.id)} />}
      <label className="flex flex-col gap-1">
        Lestype
        <select name="activity_id" required defaultValue={v('activity_id')} className="hoe-input w-full">
          <option value="">—</option>
          {activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Instructeur
        <select name="instructor_id" defaultValue={v('instructor_id')} className="hoe-input w-full">
          <option value="">—</option>
          {instructors.map((i) => <option key={i.id} value={i.id}>{i.display_name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Ruimte
        <select name="room_id" defaultValue={v('room_id')} className="hoe-input w-full">
          <option value="">—</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Capaciteit
        <input name="capacity" type="number" required defaultValue={v('capacity') || '12'}
          className="hoe-input w-full" />
      </label>
      <label className="flex flex-col gap-1">
        Start
        <input name="starts_at" type="datetime-local" required defaultValue={dt('starts_at')}
          className="hoe-input w-full" />
      </label>
      <label className="flex flex-col gap-1">
        Eind
        <input name="ends_at" type="datetime-local" required defaultValue={dt('ends_at')}
          className="hoe-input w-full" />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="is_off_peak" defaultChecked={Boolean(cls?.is_off_peak)} />
        Daluren
      </label>
      <label className="flex flex-col gap-1">
        Max wachtlijst (leeg = studio-default)
        <input name="max_waitlist" type="number" defaultValue={v('max_waitlist')}
          className="hoe-input w-full" />
      </label>
      <div className="col-span-2">
        <button className="hoe-btn-sm">Opslaan</button>
      </div>
    </form>
  );
}
