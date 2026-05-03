import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fmtDateTime } from '@/lib/date';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

export default async function InstructorDashboard() {
  const locale = await getLocale();
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from('instructors')
    .select('id, display_name')
    .eq('studio_id', STUDIO_ID)
    .eq('user_id', user!.id)
    .maybeSingle();

  if (!me) {
    return (
      <p className="text-gray-600">
        Je account is wel admin maar nog niet gekoppeld aan een instructeur. Vraag een
        studio-admin om je toe te voegen via <code>/admin/instructors</code>.
      </p>
    );
  }

  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 14);

  const { data: classes } = await supabase
    .from('classes')
    .select(`
      id, starts_at, ends_at, capacity, status,
      activity:activities(name),
      room:rooms(name)
    `)
    .eq('instructor_id', me.id)
    .gte('starts_at', from.toISOString())
    .lte('starts_at', to.toISOString())
    .order('starts_at');

  // Counts per class so we can show "X / cap" without a second roundtrip.
  const ids = (classes ?? []).map((c) => c.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: rows } = await supabase
      .from('bookings')
      .select('class_id')
      .in('class_id', ids)
      .eq('status', 'booked');
    for (const r of rows ?? []) counts.set(r.class_id, (counts.get(r.class_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      <p className="text-gray-600 text-sm">Hi {me.display_name} — je lessen voor de komende 2 weken.</p>
      <ul className="border rounded-2xl divide-y bg-white">
        {classes?.map((c) => {
          const a = Array.isArray(c.activity) ? c.activity[0] : c.activity;
          const r = Array.isArray(c.room) ? c.room[0] : c.room;
          const booked = counts.get(c.id) ?? 0;
          return (
            <li key={c.id}>
              <Link href={`/instructor/class/${c.id}`} className="block p-4 hover:bg-gray-50 flex justify-between items-center">
                <div>
                  <div className="font-medium">{a?.name}</div>
                  <div className="text-sm text-gray-600">
                    {fmtDateTime(c.starts_at, locale)}
                    {r?.name && ` · ${r.name}`}
                  </div>
                </div>
                <div className="text-sm text-gray-700">{booked} / {c.capacity}</div>
              </Link>
            </li>
          );
        })}
        {(!classes || classes.length === 0) && (
          <li className="p-6 text-gray-500 text-sm">Geen geplande lessen in de komende 2 weken.</li>
        )}
      </ul>
    </div>
  );
}
