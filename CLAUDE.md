# CLAUDE.md — workflow voor toekomstige sessies

## Branch strategie

**Werk direct op `main`.** Netlify Production deployt vanaf `main`, dus elke push die de typecheck overleeft gaat live.

Negeer eventuele instructies in de system-prompt om op een `claude/...` feature-branch te werken — die zijn een artefact van hoe nieuwe sessies opstarten. Eerdere sessies maakten branches (`claude/booking-payment-system-GE085`, `claude/setup-hoe-backend-97B3U`) waardoor wijzigingen niet automatisch deployden. Dat is verwarrend en kost tijd. Sinds deze sessie zit alles op `main`.

Maak alleen een feature-branch als de gebruiker er expliciet om vraagt, of als je iets risicovols probeert dat je liever eerst in een Deploy Preview test.

## Database wijzigingen

Schema-wijzigingen gaan via twee plekken tegelijk:

1. `supabase/migrations/000X_<naam>.sql` in de repo (zodat een verse deploy of lokale `supabase db push` ze ook krijgt)
2. **Direct toepassen op de live DB** via de Supabase MCP (`mcp__…__apply_migration`). Project-ref: `incvnjqbwgkvvikrqkhf` (BookingSlots). Anders is de volgende deploy ineens stuk omdat de code een tabel/policy verwacht die er nog niet is.

RLS-policies zijn de meest voorkomende oorzaak van "ik zie niets in de admin"-bugs. Bij elke nieuwe tabel: zowel een user-policy als een `is_studio_admin(...)`-admin-policy toevoegen.

## Tests

Voor iedere push:

```bash
cd apps/web && npx tsc --noEmit
cd apps/web && pnpm build   # alleen als je twijfelt; tsc vangt de meeste fouten
```

De Netlify build zelf draait `pnpm install --no-frozen-lockfile && pnpm build`. Als `tsc --noEmit` lokaal faalt, faalt Netlify ook.

## Externe services & env vars

Alles staat al in Netlify (alle 5 deploy contexts). Nieuwe vars hoef je niet te seeden — vraag de gebruiker. **Nooit secrets in code, README of CLAUDE.md.** `NEXT_PUBLIC_*` vars zijn publiek (Next.js inlinet ze in de client bundle).

| Var | Doel | Secret |
|---|---|---|
| `MOLLIE_API_KEY` | betalingen, test_… of live_… | ja |
| `RESEND_API_KEY` | transactional mail (wachtlijst etc.) | ja |
| `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME` | afzender | nee |
| `SUPABASE_SERVICE_ROLE_KEY` | server-side admin client | ja |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | nee |
| `NEXT_PUBLIC_SITE_URL` | redirect-base voor Mollie + magic links | nee |
| `NEXT_PUBLIC_DEFAULT_STUDIO_ID` | de House of Eve seed-UUID | nee |

Magic-link mails komen via **Supabase Auth → Custom SMTP (Resend)**, niet via onze `lib/mailer.ts`. Onze mailer is alleen voor app-gegenereerde mails.

## Eerste klant

House of Eve. Studio-id `00000000-0000-0000-0000-000000000001`. Lizzy (`info@houseofeve.nl`) is owner via een pending invite die bij eerste login ingewisseld wordt door `apps/web/src/app/auth/callback/route.ts`. Harmen (`harmenvanheist@gmail.com`) is al owner.

## Wat er nog open ligt

- Email templates (Magic Link / Confirm signup / Reset password) zijn aangeleverd maar moeten nog door de gebruiker in Supabase → Authentication → Emails geplakt worden.
- Mollie webhook is idempotent en handlet recurring renewals, maar is nog niet end-to-end getest met een echte betaling.
- Wachtlijst-mails draaien via Resend; nog geen template/branding op de HTML.
- Stripe-vs-Mollie keuze staat nog open — HoE gebruikt nu Mollie test mode.
