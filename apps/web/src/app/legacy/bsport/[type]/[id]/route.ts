import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// Drop-in replacement for `backoffice.bsport.io/customer/payment/pass/{id}` and
// `backoffice.bsport.io/checkout/{companyId}/subscription/{id}` so the existing
// Webflow links keep working after we swap CDN/script hosts.
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id } = await ctx.params;
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('legacy_bsport_pass_map')
    .select('kind, pass_id, subscription_id')
    .eq('bsport_id', id)
    .single();

  if (!data) {
    return NextResponse.redirect(new URL('/prijzen?legacy=notfound', _req.url));
  }
  if (data.kind === 'pass' && data.pass_id) {
    return NextResponse.redirect(new URL(`/prijzen?buy=${data.pass_id}`, _req.url));
  }
  if (data.kind === 'subscription' && data.subscription_id) {
    return NextResponse.redirect(
      new URL(`/prijzen?sub=${data.subscription_id}`, _req.url)
    );
  }
  return NextResponse.redirect(new URL('/prijzen', _req.url));
}
