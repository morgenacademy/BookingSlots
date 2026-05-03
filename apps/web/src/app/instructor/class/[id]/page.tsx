import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fmtDateTime } from '@/lib/date';
import { markAttended, markNoShow, unmark } from './actions';

export default async function InstructorClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const supabase = await getSupabaseServer();

  const { data: cls } = await supabase
    .from('classes')
    .select(`
      id, starts_at, ends_at, capacity,
      activity:activities(name),
      room:rooms(name),
      instructor:instructors(display_name, user_id)
    `)
    .eq('id', id)
    .single();
  if (!cls) redirect('/instructor');

  const a = Array.isArray(cls.activity) ? cls.activity[0] : cls.activity;
  const r = Array.isArray(cls.room) ? cls.room[0] : cls.room;

  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id, status, waitlist_position, created_at,
      user:profiles(email, first_name, last_name, phone)
    `)
    .eq('class_id', id)
    .in('status', ['booked', 'waitlisted', 'attended', 'no_show'])
    .order('status')
    .order('created_at');

  const booked = bookings?.filter((b) => b.status !== 'waitlisted') ?? [];
  const waiting = bookings?.filter((b) => b.status === 'waitlisted') ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/instructor" className="text-sm underline">← terug</Link>
        <h2 className="font-display text-2xl mt-2">{a?.name}</h2>
        <p className="text-sm text-gray-600">
          {fmtDateTime(cls.starts_at, locale)}
          {r?.name && ` · ${r.name}`}
          {' · '}{booked.length} / {cls.capacity} aanwezig
        </p>
      </div>

      <section>
        <h3 className="font-display text-lg mb-2">Deelnemers</h3>
        <ul className="border rounded-2xl divide-y bg-white">
          {booked.map((b) => {
            const u = Array.isArray(b.user) ? b.user[0] : b.user;
            return (
              <li key={b.id} className="p-4 flex justify-between items-center gap-4">
                <div>
                  <div className="font-medium">
                    {[u?.first_name, u?.last_name].filter(Boolean).join(' ') || u?.email || '—'}
                  </div>
                  <div className="text-sm text-gray-500">
                    {u?.email}{u?.phone && ` · ${u.phone}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={
                    b.status === 'attended' ? 'text-green-700 text-sm' :
                    b.status === 'no_show' ? 'text-red-700 text-sm' :
                    'text-gray-600 text-sm'
                  }>
                    {b.status === 'attended' ? 'Aanwezig' :
                     b.status === 'no_show' ? 'No-show' : 'Geboekt'}
                  </span>
                  {b.status === 'booked' ? (
                    <>
                      <form action={markAttended}>
                        <input type="hidden" name="booking_id" value={b.id} />
                        <button className="hoe-btn-sm-ghost">Aanwezig</button>
                      </form>
                      <form action={markNoShow}>
                        <input type="hidden" name="booking_id" value={b.id} />
                        <button className="hoe-btn-sm-ghost">No-show</button>
                      </form>
                    </>
                  ) : (
                    <form action={unmark}>
                      <input type="hidden" name="booking_id" value={b.id} />
                      <button className="text-sm underline">terug naar geboekt</button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
          {booked.length === 0 && (
            <li className="p-6 text-gray-500 text-sm">Nog geen aanmeldingen.</li>
          )}
        </ul>
      </section>

      {waiting.length > 0 && (
        <section>
          <h3 className="font-display text-lg mb-2">Wachtlijst</h3>
          <ul className="border rounded-2xl divide-y bg-white">
            {waiting.map((b) => {
              const u = Array.isArray(b.user) ? b.user[0] : b.user;
              return (
                <li key={b.id} className="p-4 flex justify-between items-center">
                  <div>
                    <div className="font-medium">
                      #{b.waitlist_position} · {[u?.first_name, u?.last_name].filter(Boolean).join(' ') || u?.email}
                    </div>
                    <div className="text-sm text-gray-500">{u?.email}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
