import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { fmtDateTime } from '@/lib/date';

const STUDIO_ID = process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!;

const STATUS_LABEL: Record<string, string> = {
  paid: 'Betaald',
  pending: 'In afwachting',
  failed: 'Mislukt',
  cancelled: 'Geannuleerd',
  refunded: 'Terugbetaald',
};

const STATUS_COLOR: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  pending: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-700',
  refunded: 'bg-blue-100 text-blue-800',
};

function fmtEuro(cents: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export default async function OrdersAdmin({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const supabase = await getSupabaseServer();

  let query = supabase
    .from('orders')
    .select(`
      id, total_eur_cents, status, mollie_payment_id, paid_at, invoice_number, created_at,
      user:profiles(email, first_name, last_name),
      items:order_items(item_kind, quantity, pass:passes(name), subscription:subscriptions(name))
    `)
    .eq('studio_id', STUDIO_ID)
    .order('created_at', { ascending: false })
    .limit(200);

  if (sp.status) query = query.eq('status', sp.status);

  const { data: orders } = await query;

  const totals = (orders ?? []).reduce(
    (acc, o) => {
      acc.count++;
      if (o.status === 'paid') {
        acc.paidCount++;
        acc.paidCents += o.total_eur_cents;
      }
      return acc;
    },
    { count: 0, paidCount: 0, paidCents: 0 },
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">Betalingen</h1>
        <p className="text-sm text-gray-600 mt-1">
          {totals.paidCount} betaalde orders · totaal {fmtEuro(totals.paidCents)}
        </p>
      </header>

      <nav className="flex gap-2 text-sm">
        {(['', 'paid', 'pending', 'failed', 'refunded'] as const).map((s) => (
          <Link
            key={s || 'all'}
            href={s ? `/admin/orders?status=${s}` : '/admin/orders'}
            className={`px-3 py-1 rounded-full border ${
              (sp.status ?? '') === s ? 'bg-black text-white border-black' : 'hover:bg-gray-50'
            }`}
          >
            {s === '' ? 'Alle' : STATUS_LABEL[s]}
          </Link>
        ))}
      </nav>

      <div className="border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Datum</th>
              <th className="p-3">Klant</th>
              <th className="p-3">Item(s)</th>
              <th className="p-3 text-right">Bedrag</th>
              <th className="p-3">Status</th>
              <th className="p-3">Factuur</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders?.map((o) => {
              const u = Array.isArray(o.user) ? o.user[0] : o.user;
              return (
                <tr key={o.id} className="align-top">
                  <td className="p-3 whitespace-nowrap text-gray-700">
                    {fmtDateTime(o.paid_at ?? o.created_at, locale)}
                  </td>
                  <td className="p-3">
                    <div>{[u?.first_name, u?.last_name].filter(Boolean).join(' ') || '—'}</div>
                    <div className="text-gray-500 text-xs">{u?.email}</div>
                  </td>
                  <td className="p-3">
                    {(o.items ?? []).map((it, i) => {
                      const pass = Array.isArray(it.pass) ? it.pass[0] : it.pass;
                      const sub = Array.isArray(it.subscription) ? it.subscription[0] : it.subscription;
                      const name = pass?.name ?? sub?.name ?? it.item_kind;
                      return (
                        <div key={i}>
                          {it.quantity}× {name}
                        </div>
                      );
                    })}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">{fmtEuro(o.total_eur_cents)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[o.status] ?? ''}`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="p-3 text-gray-700">
                    {o.invoice_number ?? '—'}
                    {o.mollie_payment_id && (
                      <div className="text-xs text-gray-400">{o.mollie_payment_id}</div>
                    )}
                  </td>
                </tr>
              );
            })}
            {(!orders || orders.length === 0) && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">
                  Nog geen orders.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
