import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fmtDateTime } from '@/lib/date';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

const STATUS_LABEL: Record<string, string> = {
  booked: 'Geboekt',
  waitlisted: 'Wachtlijst',
  cancelled: 'Geannuleerd',
  no_show: 'No-show',
  attended: 'Aanwezig',
};

export default async function BookingsAdmin({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const supabase = await getSupabaseServer();

  // Upcoming classes for the picker.
  const { data: classes } = await supabase
    .from('classes')
    .select('id, starts_at, activity:activities(name)')
    .eq('studio_id', STUDIO_ID)
    .gte('starts_at', new Date(Date.now() - 7 * 86400000).toISOString())
    .order('starts_at')
    .limit(100);

  let bookingsQuery = supabase
    .from('bookings')
    .select(`
      id, status, credits_used, created_at, waitlist_position, waitlist_invited_at,
      user:profiles(email, first_name, last_name),
      class:classes(starts_at, activity:activities(name))
    `)
    .eq('studio_id', STUDIO_ID)
    .order('created_at', { ascending: false })
    .limit(500);

  if (sp.class) bookingsQuery = bookingsQuery.eq('class_id', sp.class);
  if (sp.status) bookingsQuery = bookingsQuery.eq('status', sp.status);

  const { data: bookings } = await bookingsQuery;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">Boekingen</h1>
      </header>

      <form className="flex gap-3 items-end text-sm flex-wrap">
        <label className="flex flex-col gap-1">
          Filter op klas
          <select name="class" defaultValue={sp.class ?? ''} className="border rounded px-2 py-1 min-w-[260px]">
            <option value="">— Alle klassen —</option>
            {classes?.map((c) => {
              const a = Array.isArray(c.activity) ? c.activity[0] : c.activity;
              return (
                <option key={c.id} value={c.id}>
                  {fmtDateTime(c.starts_at, locale)} — {a?.name}
                </option>
              );
            })}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Status
          <select name="status" defaultValue={sp.status ?? ''} className="border rounded px-2 py-1">
            <option value="">— Alle —</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <button className="border rounded px-4 py-1.5 hover:bg-gray-50">Filter</button>
        {(sp.class || sp.status) && (
          <Link href="/admin/bookings" className="text-sm underline self-end mb-1">reset</Link>
        )}
      </form>

      <div className="border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Klas</th>
              <th className="p-3">Klant</th>
              <th className="p-3">Status</th>
              <th className="p-3">Credits</th>
              <th className="p-3">Geboekt op</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {bookings?.map((b) => {
              const u = Array.isArray(b.user) ? b.user[0] : b.user;
              const c = Array.isArray(b.class) ? b.class[0] : b.class;
              const a = c && (Array.isArray(c.activity) ? c.activity[0] : c.activity);
              return (
                <tr key={b.id}>
                  <td className="p-3">
                    <div className="font-medium">{a?.name}</div>
                    <div className="text-xs text-gray-500">{c && fmtDateTime(c.starts_at, locale)}</div>
                  </td>
                  <td className="p-3">
                    <div>{[u?.first_name, u?.last_name].filter(Boolean).join(' ') || '—'}</div>
                    <div className="text-xs text-gray-500">{u?.email}</div>
                  </td>
                  <td className="p-3">
                    {STATUS_LABEL[b.status] ?? b.status}
                    {b.status === 'waitlisted' && b.waitlist_position && (
                      <span className="text-xs text-gray-500"> · #{b.waitlist_position}</span>
                    )}
                  </td>
                  <td className="p-3">{b.credits_used}</td>
                  <td className="p-3 text-gray-700">{fmtDateTime(b.created_at, locale)}</td>
                </tr>
              );
            })}
            {(!bookings || bookings.length === 0) && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  Geen boekingen gevonden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
