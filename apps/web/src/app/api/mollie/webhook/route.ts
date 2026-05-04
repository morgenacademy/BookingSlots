import { NextResponse, type NextRequest } from 'next/server';
import { PaymentStatus, type Payment } from '@mollie/api-client';
import { addDays } from '@/lib/date';
import { mollie } from '@/lib/mollie';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// Mollie posts the payment id as form-urlencoded `id=tr_...`. We re-fetch the
// canonical payment to avoid trusting the body. The handler is idempotent —
// Mollie retries the webhook on any non-2xx response, and re-delivers status
// transitions over the lifetime of a payment.
export async function POST(req: NextRequest) {
  const body = await req.text();
  const params = new URLSearchParams(body);
  const paymentId = params.get('id');
  if (!paymentId) return NextResponse.json({ ok: false }, { status: 400 });

  const payment = await mollie().payments.get(paymentId);
  const admin = getSupabaseAdmin();
  const meta = payment.metadata as Record<string, string> | null;

  if (meta?.kind === 'subscription_first') {
    await handleSubscriptionFirst(payment, meta, admin);
    return NextResponse.json({ ok: true });
  }

  // Recurring subscription renewal: Mollie sets `subscriptionId` on payment and
  // there's no metadata. Match by mollie_subscription_id.
  if (payment.subscriptionId) {
    await handleSubscriptionRenewal(payment, admin);
    return NextResponse.json({ ok: true });
  }

  if (meta?.order_id) {
    await handleOrderPayment(payment, meta.order_id, admin);
  }

  return NextResponse.json({ ok: true });
}

type Admin = ReturnType<typeof getSupabaseAdmin>;

async function handleOrderPayment(payment: Payment, orderId: string, admin: Admin) {
  const failed: PaymentStatus[] = [
    PaymentStatus.failed,
    PaymentStatus.expired,
    PaymentStatus.canceled,
  ];
  const status =
    payment.status === PaymentStatus.paid
      ? 'paid'
      : failed.includes(payment.status)
        ? 'failed'
        : 'pending';

  const { data: existing } = await admin
    .from('orders')
    .select('status, studio_id, user_id, invoice_number')
    .eq('id', orderId)
    .single();
  if (!existing) return;

  // Idempotency: if order is already paid we've materialised everything.
  if (existing.status === 'paid' && status === 'paid') return;

  const update: Record<string, unknown> = { status };
  if (status === 'paid' && !existing.invoice_number) {
    update.paid_at = new Date().toISOString();
    const { data: studio } = await admin
      .from('studios')
      .select('invoice_number_prefix')
      .eq('id', existing.studio_id)
      .single();
    const { data: numRow } = await admin.rpc('next_invoice_number', {
      p_studio: existing.studio_id,
      p_year: new Date().getFullYear(),
      p_prefix: studio?.invoice_number_prefix ?? 'INV',
    });
    if (numRow) update.invoice_number = numRow;
  }
  await admin.from('orders').update(update).eq('id', orderId);

  if (status !== 'paid') return;

  // Penalty payments — mark the matching subscription_penalties row as paid.
  const meta = payment.metadata as Record<string, string> | null;
  if (meta?.kind === 'penalty' && meta.penalty_id) {
    await admin
      .from('subscription_penalties')
      .update({ status: 'paid' })
      .eq('id', meta.penalty_id);
    return; // no pass-materialisation needed for fines
  }

  const { data: items } = await admin
    .from('order_items')
    .select('id, item_kind, pass_id, quantity')
    .eq('order_id', orderId);

  for (const item of items ?? []) {
    if (item.item_kind !== 'pass' || !item.pass_id) continue;

    // Idempotency per item: skip if user_passes already exist for this order_item link.
    // We tag user_passes via source = 'purchase' + matching pass+user; the simplest
    // strong key is the payment_id itself stored in source… but we don't have a column.
    // Instead we check whether the user already has the right number of unused
    // copies of this pass attributable to this order's paid_at moment.
    const { count: alreadyGranted } = await admin
      .from('user_passes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', existing.user_id)
      .eq('pass_id', item.pass_id)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    if ((alreadyGranted ?? 0) >= (item.quantity ?? 1)) continue;

    const { data: pass } = await admin
      .from('passes')
      .select('credits, validity_days, activate_on_first_attendance')
      .eq('id', item.pass_id)
      .single();
    if (!pass) continue;

    const now = new Date();
    const expires = pass.activate_on_first_attendance
      ? addDays(now, 365)
      : addDays(now, pass.validity_days);

    const toCreate = (item.quantity ?? 1) - (alreadyGranted ?? 0);
    const rows = Array.from({ length: toCreate }, () => ({
      studio_id: existing.studio_id,
      user_id: existing.user_id,
      pass_id: item.pass_id,
      credits_remaining: pass.credits,
      activated_at: pass.activate_on_first_attendance ? null : now.toISOString(),
      expires_at: expires.toISOString(),
      source: 'purchase' as const,
    }));
    if (rows.length) await admin.from('user_passes').insert(rows);
  }
}

async function handleSubscriptionFirst(
  payment: Payment,
  meta: Record<string, string>,
  admin: Admin
) {
  if (payment.status !== PaymentStatus.paid) return;
  if (!payment.customerId) return;

  // Idempotency: if we already have a user_subscription tied to this customer
  // for this template, do nothing.
  const { data: profile } = await admin
    .from('profiles')
    .select('id, studio_id')
    .eq('mollie_customer_id', payment.customerId)
    .single();
  if (!profile) return;

  const subId = meta.subscription_template_id;
  const { data: alreadyActive } = await admin
    .from('user_subscriptions')
    .select('id')
    .eq('user_id', profile.id)
    .eq('subscription_id', subId)
    .eq('status', 'active')
    .maybeSingle();
  if (alreadyActive) return;

  const { data: sub } = await admin
    .from('subscriptions')
    .select('*')
    .eq('id', subId)
    .single();
  if (!sub) return;

  const mollieSub = await mollie().customerSubscriptions.create({
    customerId: payment.customerId,
    amount: { currency: 'EUR', value: (sub.price_eur_cents / 100).toFixed(2) },
    interval: '1 month',
    description: sub.name,
    webhookUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/api/mollie/webhook`,
  });

  const periodEnd = addDays(new Date(), 30);
  const { data: userSub } = await admin
    .from('user_subscriptions')
    .insert({
      studio_id: profile.studio_id,
      user_id: profile.id,
      subscription_id: sub.id,
      mollie_subscription_id: mollieSub.id,
      status: 'active',
      current_period_end: periodEnd.toISOString(),
    })
    .select('id')
    .single();

  if (userSub && !sub.unlimited && sub.credits_per_period) {
    await admin.from('user_passes').insert({
      studio_id: profile.studio_id,
      user_id: profile.id,
      user_subscription_id: userSub.id,
      credits_remaining: sub.credits_per_period,
      activated_at: new Date().toISOString(),
      expires_at: periodEnd.toISOString(),
      source: 'manual',
    });
  }
}

async function handleSubscriptionRenewal(payment: Payment, admin: Admin) {
  if (payment.status !== PaymentStatus.paid) return;

  const { data: userSub } = await admin
    .from('user_subscriptions')
    .select('id, studio_id, user_id, subscription_id, current_period_end')
    .eq('mollie_subscription_id', payment.subscriptionId!)
    .single();
  if (!userSub) return;

  const { data: sub } = await admin
    .from('subscriptions')
    .select('credits_per_period, unlimited, credit_rollover')
    .eq('id', userSub.subscription_id)
    .single();
  if (!sub) return;

  const newPeriodEnd = addDays(new Date(), 30);

  // Idempotency: avoid double-grant if same payment fires twice.
  const { count: existingThisPeriod } = await admin
    .from('user_passes')
    .select('id', { count: 'exact', head: true })
    .eq('user_subscription_id', userSub.id)
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if ((existingThisPeriod ?? 0) > 0) return;

  if (!sub.credit_rollover) {
    await admin
      .from('user_passes')
      .update({ credits_remaining: 0 })
      .eq('user_subscription_id', userSub.id)
      .gt('credits_remaining', 0);
  }

  if (!sub.unlimited && sub.credits_per_period) {
    await admin.from('user_passes').insert({
      studio_id: userSub.studio_id,
      user_id: userSub.user_id,
      user_subscription_id: userSub.id,
      credits_remaining: sub.credits_per_period,
      activated_at: new Date().toISOString(),
      expires_at: newPeriodEnd.toISOString(),
      source: 'manual',
    });
  }

  await admin
    .from('user_subscriptions')
    .update({ current_period_end: newPeriodEnd.toISOString() })
    .eq('id', userSub.id);
}
