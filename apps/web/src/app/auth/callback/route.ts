import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

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
      }
      return NextResponse.redirect(new URL(next, request.url));
    }
  }
  return NextResponse.redirect(new URL('/login?error=1', request.url));
}
