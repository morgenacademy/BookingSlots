import { createClient } from '@supabase/supabase-js';

// Service-role client. Only import from server code (route handlers, server actions, edge functions).
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
