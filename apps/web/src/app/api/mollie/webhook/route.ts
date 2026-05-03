import { NextResponse, type NextRequest } from 'next/server';
import { PaymentStatus } from '@mollie/api-client';
import { addDays } from '@/lib/date';
import { mollie } from '@/lib/mollie';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// Mollie posts the payment id as form-urlencoded `id=tr_...`. We re-fetch the
// canonical payment to avoid trusting the body.
export async function POST(req: NextRequest) {
  const body = await req.text();
  const params = new URLSearchParams(body);
  const paymentId = params.get('id');
  if (!paymentId) return NextResponse.json({ ok: false }, { status: 400 });

  const payment = await mollie().payments.get(paymentId);
  const admin = getSupabaseAdmin();

  const meta = payment.metadata as Record<string, string> | null;

  // Subscription first-payment: create mandate + subscription
  if (meta?.kind === 'subscription_first' && payment.status === PaymentStatus.paid) {
    const subId = meta.subscription_template_id;
    const { data: sub } = await admin
      .from('subscriptions')
      .select('*')
      .eq('id', subId)
      .single();
    if (sub && payment.customerId) {
      const mollieSub = await mollie().customerSubscriptions.create({
        customerId: payment.customerId,
        amount: { currency: 'EUR', value: (sub.price_eur_cents / 100).toFixed(2) },
        interval: '1 month',
        description: sub.name,
        webhookUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/api/mollie/webhook`,
      });
      const { data: profile } = await admin
        .from('profiles')
        .select('id, studio_id')
        .eq('mollie_customer_id', payment.customerId)
        .single();
      if (profile) {
        await admin.from('user_subscriptions').insert({
          studio_id: profile.studio_id,
          user_id: profile.id,
          subscription_id: sub.id,
          mollie_subscription_id: mollieSub.id,
          status: 'active',
          current_period_end: addDays(new Date(), 30).toISOString(),
        });
        // Drop credits for first period
        if (!sub.unlimited && sub.credits_per_period) {
          await admin.from('user_passes').insert({
            studio_id: profile.studio_id,
            user_id: profile.id,
            pass_id: null as unknown as string, // subscription credits live in user_passes too — stub
            credits_remaining: sub.credits_per_period,
            activated_at: new Date().toISOString(),
            expires_at: addDays(new Date(), 30).toISOString(),
            source: 'manual',
          });
        }
      }
    }
    return NextResponse.json({ ok: true });
  }

  // Regular order payment
  const orderId = meta?.order_id;
  if (!orderId) return NextResponse.json({ ok: true });

  const failedStates: PaymentStatus[] = [
    PaymentStatus.failed,
    PaymentStatus.expired,
    PaymentStatus.canceled,
  ];
  const status =
    payment.status === PaymentStatus.paid
      ? 'paid'
      : failedStates.includes(payment.status)
        ? 'failed'
        : 'pending';

  await admin
    .from('orders')
    .update({
      status,
      paid_at: payment.status === PaymentStatus.paid ? new Date().toISOString() : null,
    })
    .eq('id', orderId);

  if (payment.status === PaymentStatus.paid) {
    // Materialise pass purchase → user_passes
    const { data: items } = await admin
      .from('order_items')
      .select('item_kind, pass_id, quantity, order_id')
      .eq('order_id', orderId);
    const { data: order } = await admin
      .from('orders')
      .select('user_id, studio_id')
      .eq('id', orderId)
      .single();

    for (const item of items ?? []) {
      if (item.item_kind !== 'pass' || !item.pass_id || !order) continue;
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
      for (let i = 0; i < (item.quantity ?? 1); i++) {
        await admin.from('user_passes').insert({
          studio_id: order.studio_id,
          user_id: order.user_id,
          pass_id: item.pass_id,
          credits_remaining: pass.credits,
          activated_at: pass.activate_on_first_attendance ? null : now.toISOString(),
          expires_at: expires.toISOString(),
          source: 'purchase',
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
