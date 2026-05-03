import createMollieClient, { type MollieClient } from '@mollie/api-client';

let cached: MollieClient | null = null;

export function mollie(): MollieClient {
  if (cached) return cached;
  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) throw new Error('MOLLIE_API_KEY missing');
  cached = createMollieClient({ apiKey });
  return cached;
}

export const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
