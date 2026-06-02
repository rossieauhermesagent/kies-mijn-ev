-- Kies Mijn EV Supabase schema
-- Run this in Supabase SQL Editor once, then run: npm run import:ev

create extension if not exists pgcrypto;

create table if not exists public.ev_vehicles (
  id uuid primary key default gen_random_uuid(),
  external_id integer not null unique,
  slug text not null,
  source_url text not null,
  data_source text not null default 'ev-database.org/nl',
  availability text,
  make text not null,
  model text not null,
  variant text,
  full_name text not null,
  image_url text,
  price_eur integer,
  lease_price_eur_month integer,
  battery_usable_kwh numeric,
  battery_nominal_kwh numeric,
  range_real_km integer,
  efficiency_wh_per_km integer,
  wltp_range_km integer,
  acceleration_0_100_s numeric,
  top_speed_kmh integer,
  drive text,
  seats integer,
  fastcharge_speed_avg_kw integer,
  fastcharge_speed_kmh integer,
  charge_power_ac_kw numeric,
  charge_time_ac text,
  plug_type text,
  curb_weight_kg integer,
  gross_weight_kg integer,
  towing_weight_braked_kg integer,
  towing_weight_unbraked_kg integer,
  towbar_possible boolean,
  roof_load_kg integer,
  boot_space_liters integer,
  boot_space_max_liters integer,
  v2l_supported boolean,
  body_type text,
  segment text,
  raw_specs jsonb not null default '{}'::jsonb,
  last_scraped_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ev_vehicles_make_idx on public.ev_vehicles(make);
create index if not exists ev_vehicles_price_idx on public.ev_vehicles(price_eur);
create index if not exists ev_vehicles_range_idx on public.ev_vehicles(range_real_km);
create index if not exists ev_vehicles_efficiency_idx on public.ev_vehicles(efficiency_wh_per_km);
create index if not exists ev_vehicles_availability_idx on public.ev_vehicles(availability);

alter table public.ev_vehicles enable row level security;

drop policy if exists "EV vehicles are publicly readable" on public.ev_vehicles;
create policy "EV vehicles are publicly readable"
  on public.ev_vehicles for select
  using (true);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_ev_vehicles_updated_at on public.ev_vehicles;
create trigger set_ev_vehicles_updated_at
before update on public.ev_vehicles
for each row execute function public.set_updated_at();
