# Kies Mijn EV

React/Next.js website for browsing EV specifications imported from ev-database.org/nl into Supabase.

## Features

- Supabase-backed EV catalogue
- Filters for make, availability, body type, max price, minimum real-world range, and towbar capability
- Sort by real range, price, efficiency, or usable battery size
- Import script with block-page guardrails to avoid storing poisoned anti-bot responses
- Supabase schema with public read-only RLS policy for frontend access

## Setup

1. Copy env file:

```bash
cp .env.example .env.local
```

2. Fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://bfkictnjyfyexwdgysfj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

3. Create the database table by running `supabase/schema.sql` in the Supabase SQL Editor.

4. Import EV data:

```bash
npm run import:ev
```

5. Start the site:

```bash
npm run dev
```

## Data model

Main table: `public.ev_vehicles`

Important fields:

- `external_id`: ev-database internal vehicle ID, unique for idempotent upserts
- `availability`: available/discontinued/etc.
- `price_eur`
- `range_real_km`
- `efficiency_wh_per_km`
- `battery_usable_kwh`
- `towing_weight_braked_kg`
- `raw_specs`: original parsed Dutch labels for audit/recovery

## Scraping notes

EV Database can block datacenter/headless traffic. The importer checks for known block markers like `Request blocked`, `anomalies detected`, and `OFFICIALDATAPARTNER` before parsing/upserting.

If live detail pages are blocked, use the same schema and importer structure with a Wayback/FlareSolverr fetch function.
