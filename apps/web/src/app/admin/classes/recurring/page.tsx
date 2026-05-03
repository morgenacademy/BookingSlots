import { getSupabaseServer } from '@/lib/supabase/server';
import { generateRecurring } from './actions';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

const DOWS = [
  ['1', 'ma'],
  ['2', 'di'],
  ['3', 'wo'],
  ['4', 'do'],
  ['5', 'vr'],
  ['6', 'za'],
  ['0', 'zo'],
];

function isoDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function RecurringPage() {
  const supabase = await getSupabaseServer();
  const [{ data: activities }, { data: instructors }, { data: rooms }] = await Promise.all([
    supabase.from('activities').select('id, name, default_duration_minutes').eq('studio_id', STUDIO_ID),
    supabase.from('instructors').select('id, display_name').eq('studio_id', STUDIO_ID),
    supabase.from('rooms').select('id, name').eq('studio_id', STUDIO_ID),
  ]);

  const today = new Date();
  const inFour = new Date(today);
  inFour.setDate(today.getDate() + 28);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl sm:text-3xl">Terugkerende klassen</h1>
        <p className="text-sm text-gray-600 mt-1">
          Genereer in één keer een blok klassen op vaste dagen en tijden.
        </p>
      </header>

      <form action={generateRecurring} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border rounded-2xl p-6">
        <label className="flex flex-col gap-1">
          Lestype
          <select name="activity_id" required className="hoe-input w-full">
            <option value="">—</option>
            {activities?.map((a) => (
              <option key={a.id} value={a.id} data-duration={a.default_duration_minutes}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Instructeur
          <select name="instructor_id" className="hoe-input w-full">
            <option value="">—</option>
            {instructors?.map((i) => (
              <option key={i.id} value={i.id}>{i.display_name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Ruimte
          <select name="room_id" className="hoe-input w-full">
            <option value="">—</option>
            {rooms?.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Capaciteit
          <input name="capacity" type="number" defaultValue="12" required className="hoe-input w-full" />
        </label>
        <label className="flex flex-col gap-1">
          Tijd
          <input name="time" type="time" required className="hoe-input w-full" />
        </label>
        <label className="flex flex-col gap-1">
          Duur (min)
          <input name="duration_minutes" type="number" defaultValue="50" required className="hoe-input w-full" />
        </label>
        <label className="flex flex-col gap-1">
          Eerste datum
          <input name="start_date" type="date" defaultValue={isoDate(today)} required className="hoe-input w-full" />
        </label>
        <label className="flex flex-col gap-1">
          Laatste datum
          <input name="end_date" type="date" defaultValue={isoDate(inFour)} required className="hoe-input w-full" />
        </label>
        <fieldset className="col-span-2">
          <legend className="mb-1">Dagen</legend>
          <div className="flex gap-3 flex-wrap">
            {DOWS.map(([val, lbl]) => (
              <label key={val} className="flex items-center gap-1">
                <input type="checkbox" name="dow" value={val} />
                {lbl}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 col-span-2">
          <input type="checkbox" name="is_off_peak" />
          Daluren
        </label>
        <label className="flex flex-col gap-1 col-span-2">
          Max wachtlijst (leeg = studio-default)
          <input name="max_waitlist" type="number" className="hoe-input w-full" />
        </label>
        <div className="col-span-2">
          <button className="hoe-btn-sm">Genereer</button>
        </div>
      </form>
    </div>
  );
}
