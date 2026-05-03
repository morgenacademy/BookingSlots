# BookingSlots

Booking + payment-platform voor boutique fitness/yoga/pilates-studio's. Bsport-alternatief.
Eerste klant: **House of Eve** (Den Bosch).

## Status — phase 1 in opbouw

Phase 1 levert exact wat House of Eve nu via Bsport gebruikt, inclusief drop-in
embed-widget voor hun bestaande Webflow-site. Latere fases breiden uit naar
volledige Bsport-pariteit.

| Onderdeel | Status |
|---|---|
| Supabase schema + RLS + seed (HoE) | ready |
| Auth (magic link via Supabase) | ready |
| Pricing-pagina + Mollie checkout (iDEAL/Bancontact/cards) | ready |
| Subscriptions (eerste betaling + Mollie recurring) | ready |
| Mollie webhook → `user_passes` materialisatie | ready |
| Rooster + boeken met credit-aftrek + cancel-window-refund | ready |
| Account-pagina (bookings/passes/facturen) | ready |
| Embed widget `widget.js` (loginButton/pricing/calendar, Bsport mount-ID alias) | ready |
| Legacy `/legacy/bsport/{type}/{id}` redirect-shim | ready |
| Giftcards, referrals, waitlist, no-show, admin UI | phase 2+ |
| EN-vertaling, Playwright e2e | todo |

## Stack

- **Frontend/app** — Next.js 15 (App Router, RSC), TypeScript, Tailwind, `next-intl` (NL+EN)
- **Auth + DB + Storage** — Supabase (Postgres + RLS)
- **Payments** — Mollie (iDEAL/Bancontact/cards/SEPA + Subscriptions)
- **Hosting** — Netlify
- **Embed** — vanilla JS bundle in `apps/web/public/embed/widget.js`

## Repo

```
apps/web/                       # Next.js — klant-UI
  src/app/                      # routes (auth, prijzen, rooster, account, checkout,
                                # legacy/bsport, api/embed, api/mollie/webhook)
  public/embed/widget.js        # drop-in embed (zelfde mount-API als BsportWidget)
  public/embed/example.html     # local testpagina voor de embed
supabase/
  migrations/0001_init.sql
  seed.sql                      # House of Eve studio + passes + subs + legacy Bsport map
  config.toml
netlify.toml
.env.example
```

## Lokaal draaien

```bash
# Supabase
npm i -g supabase
supabase start          # geeft anon + service-role keys + DB url
supabase db reset       # voert migration + seed uit

# Web app
cp .env.example apps/web/.env.local   # vul Supabase keys + Mollie test key
pnpm install
pnpm dev                # http://localhost:3000
```

Test-flow: `/login` → magic link → `/prijzen` → koop *Off Peak 15* → Mollie test-iDEAL → terug op `/checkout/return` → Mollie webhook materialiseert credits → `/rooster` → boek klas → credit afgeschreven → `/account` toont booking + pass + factuur.

## Embed op Webflow (House of Eve)

Vervang in de Webflow-page de Bsport script-tag:

```html
<!-- oud -->
<script src="https://cdn.bsport.io/scripts/widget.js"></script>

<!-- nieuw -->
<script src="https://app.bookingslots.nl/embed/widget.js"></script>
```

De bestaande mount-IDs (`bsport-widget-desktop` / `bsport-widget-mobile`) worden
auto-gemount als loginbutton — geen verdere HTML-wijziging nodig. Bestaande
`<a href="https://backoffice.bsport.io/customer/payment/pass/702250/...">`-knoppen
blijven werken zodra ze omgezet zijn naar
`https://app.bookingslots.nl/legacy/bsport/pass/702250`.

## Pass-IDs (House of Eve, mapping)

| Bsport ID | Pass | Onze slug |
|---|---|---|
| 702250 | Off Peak 15 | `off-peak-15` |
| 662977 | Creditbundel 15 | `creditbundel-15` |
| 662978 | Creditbundel 30 | `creditbundel-30` |
| 681648 | Creditbundel 60 | `creditbundel-60` |
| 723084 | Reformer (los) | `reformer-single` |
| 662975 | Barre/Yoga (los) | `barre-yoga-single` |
| 29515 (sub) | Starter | `starter` |
| 29779 (sub) | Flex | `flex` |
