import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/account';

  if (code) {
    const supabase = await getSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Ensure a profile row exists for the just-authed user.
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').upsert(
          {
            id: user.id,
            email: user.email!,
            studio_id: process.env.NEXT_PUBLIC_DEFAULT_STUDIO_ID!,
          },
          { onConflict: 'id', ignoreDuplicates: true }
        );

        // Redeem any pending admin invites for this email.
        if (user.email) {
          const admin = getSupabaseAdmin();
          const { data: invites } = await admin
            .from('studio_admin_invites')
            .select('studio_id, role')
            .eq('email', user.email.toLowerCase());
          if (invites?.length) {
            await admin.from('studio_admins').upsert(
              invites.map((i) => ({ studio_id: i.studio_id, user_id: user.id, role: i.role })),
              { onConflict: 'studio_id,user_id' }
            );
            await admin
              .from('studio_admin_invites')
              .delete()
              .eq('email', user.email.toLowerCase());
          }
        }
      }
      return NextResponse.redirect(new URL(next, request.url));
    }
  }
  return NextResponse.redirect(new URL('/login?error=1', request.url));
}
