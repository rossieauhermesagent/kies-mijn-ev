/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { EVVehicle } from "@/lib/types";
import {
  buyerPresets,
  formatCurrency,
  getPrimaryImage,
  getVehiclePath,
  matchesBuyerPreset,
  normaliseAvailability,
  type BuyerPreset,
} from "@/lib/vehicle-utils";
import styles from "./page.module.css";

function unique(values: Array<string | null>) {
  return [...new Set(values.filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "nl"));
}

const availabilityLabels: Record<string, string> = {
  all: "Alles",
  available: "Nu bestelbaar",
  upcoming: "Binnenkort",
  discontinued: "Niet meer leverbaar",
  other: "Overig",
};

export default function Home() {
  const [vehicles, setVehicles] = useState<EVVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [make, setMake] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [bodyType, setBodyType] = useState("all");
  const [maxPrice, setMaxPrice] = useState("all");
  const [minRange, setMinRange] = useState("all");
  const [towbarOnly, setTowbarOnly] = useState(false);
  const [sort, setSort] = useState("range_desc");
  const [preset, setPreset] = useState<BuyerPreset>("all");
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error: requestError } = await supabase
        .from("ev_vehicles")
        .select("*")
        .order("range_real_km", { ascending: false, nullsFirst: false })
        .limit(1400);

      if (requestError) setError(requestError.message);
      else setVehicles(data ?? []);
      setLoading(false);
    }

    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = vehicles.filter((car) => {
      const text = `${car.make} ${car.model} ${car.variant ?? ""} ${car.full_name}`.toLowerCase();
      if (q && !text.includes(q)) return false;
      if (make !== "all" && car.make !== make) return false;
      if (availability !== "all" && normaliseAvailability(car.availability) !== availability) return false;
      if (bodyType !== "all" && car.body_type !== bodyType) return false;
      if (maxPrice !== "all" && (!car.price_eur || car.price_eur > Number(maxPrice))) return false;
      if (minRange !== "all" && (!car.range_real_km || car.range_real_km < Number(minRange))) return false;
      if (towbarOnly && !car.towbar_possible && !car.towing_weight_braked_kg) return false;
      if (!matchesBuyerPreset(car, preset)) return false;
      return true;
    });

    result.sort((a, b) => {
      if (sort === "price_asc") return (a.price_eur ?? Infinity) - (b.price_eur ?? Infinity);
      if (sort === "efficiency_asc") return (a.efficiency_wh_per_km ?? Infinity) - (b.efficiency_wh_per_km ?? Infinity);
      if (sort === "battery_desc") return (b.battery_usable_kwh ?? 0) - (a.battery_usable_kwh ?? 0);
      if (sort === "fastcharge_desc") return (b.fastcharge_speed_kmh ?? 0) - (a.fastcharge_speed_kmh ?? 0);
      return (b.range_real_km ?? 0) - (a.range_real_km ?? 0);
    });

    return result;
  }, [vehicles, query, make, availability, bodyType, maxPrice, minRange, towbarOnly, sort, preset]);

  const makes = unique(vehicles.map((vehicle) => vehicle.make));
  const bodyTypes = unique(vehicles.map((vehicle) => vehicle.body_type));
  const compareVehicles = selected
    .map((id) => vehicles.find((vehicle) => vehicle.external_id === id))
    .filter(Boolean) as EVVehicle[];

  function toggleCompare(id: number) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 4) return current;
      return [...current, id];
    });
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Kies Mijn EV</p>
          <h1>Vind een elektrische auto op echte actieradius, prijs en praktische bruikbaarheid.</h1>
          <p className={styles.lead}>
            Kies niet alleen op merk of WLTP. Filter op dagelijkse bruikbaarheid: praktijkbereik, budget,
            laadsnelheid, trekgewicht, bagageruimte en beschikbaarheid.
          </p>
          <nav className={styles.quickLinks} aria-label="Populaire EV gidsen">
            <Link href="/beste-elektrische-auto">Beste EV&apos;s</Link>
            <Link href="/elektrische-auto-met-trekhaak">EV met trekhaak</Link>
            <Link href="/goedkope-elektrische-auto">Goedkope EV</Link>
            <Link href="/elektrische-suv">Elektrische SUV</Link>
          </nav>
        </div>
        <div className={styles.stats}>
          <strong>{vehicles.length}</strong>
          <span>EV&apos;s geïmporteerd</span>
          <strong>{filtered.length}</strong>
          <span>resultaten met filters</span>
        </div>
      </section>

      <section className={styles.presets} aria-label="Kieshulp presets">
        {buyerPresets.map((option) => (
          <button className={preset === option.id ? styles.activePreset : ""} key={option.id} onClick={() => setPreset(option.id)}>
            <strong>{option.label}</strong>
            <span>{option.description}</span>
          </button>
        ))}
      </section>

      <section className={styles.filters} aria-label="Filters">
        <label>
          Zoek
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tesla, ID.4, Scenic..." />
        </label>
        <label>
          Merk
          <select value={make} onChange={(event) => setMake(event.target.value)}>
            <option value="all">Alle merken</option>
            {makes.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label>
          Beschikbaarheid
          <select value={availability} onChange={(event) => setAvailability(event.target.value)}>
            {Object.entries(availabilityLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Type
          <select value={bodyType} onChange={(event) => setBodyType(event.target.value)}>
            <option value="all">Alle types</option>
            {bodyTypes.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label>
          Max. prijs
          <select value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)}>
            <option value="all">Geen limiet</option>
            <option value="30000">€30.000</option>
            <option value="40000">€40.000</option>
            <option value="50000">€50.000</option>
            <option value="70000">€70.000</option>
          </select>
        </label>
        <label>
          Min. real range
          <select value={minRange} onChange={(event) => setMinRange(event.target.value)}>
            <option value="all">Geen minimum</option>
            <option value="250">250 km</option>
            <option value="350">350 km</option>
            <option value="450">450 km</option>
            <option value="550">550 km</option>
          </select>
        </label>
        <label>
          Sorteren
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="range_desc">Actieradius hoog-laag</option>
            <option value="price_asc">Prijs laag-hoog</option>
            <option value="efficiency_asc">Zuinigste eerst</option>
            <option value="battery_desc">Batterij groot-klein</option>
            <option value="fastcharge_desc">Snelladen hoog-laag</option>
          </select>
        </label>
        <label className={styles.checkbox}>
          <input type="checkbox" checked={towbarOnly} onChange={(event) => setTowbarOnly(event.target.checked)} />
          Trekhaak mogelijk
        </label>
      </section>

      {compareVehicles.length > 0 && (
        <section className={styles.compare} aria-label="EV vergelijking">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Vergelijken</p>
              <h2>{compareVehicles.length}/4 auto&apos;s geselecteerd</h2>
            </div>
            <button onClick={() => setSelected([])}>Vergelijking wissen</button>
          </div>
          <div className={styles.compareTable}>
            {compareVehicles.map((car) => (
              <article key={car.external_id}>
                <img src={getPrimaryImage(car)} alt={car.full_name} />
                <h3>{car.full_name}</h3>
                <p>{formatCurrency(car.price_eur)}</p>
                <dl>
                  <div><dt>Range</dt><dd>{car.range_real_km} km</dd></div>
                  <div><dt>Verbruik</dt><dd>{car.efficiency_wh_per_km} Wh/km</dd></div>
                  <div><dt>Snelladen</dt><dd>{car.fastcharge_speed_kmh ?? "-"} km/u</dd></div>
                  <div><dt>Trekgewicht</dt><dd>{car.towing_weight_braked_kg ?? "-"} kg</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      )}

      {loading && <p className={styles.message}>EV database laden...</p>}
      {error && <p className={styles.error}>Supabase fout: {error}</p>}

      <section className={styles.grid}>
        {filtered.map((car) => (
          <article className={styles.card} key={car.external_id}>
            <Link className={styles.imageLink} href={getVehiclePath(car)}>
              <img src={getPrimaryImage(car)} alt={car.full_name} />
            </Link>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.make}>{car.make}</p>
                <h2><Link href={getVehiclePath(car)}>{car.model}</Link></h2>
                {car.variant && <p className={styles.variant}>{car.variant}</p>}
              </div>
              {car.availability && <span className={styles.badge}>{car.availability}</span>}
            </div>
            <div className={styles.metrics}>
              <div><strong>{car.range_real_km ?? "-"}</strong><span>km real range</span></div>
              <div><strong>{car.efficiency_wh_per_km ?? "-"}</strong><span>Wh/km</span></div>
              <div><strong>{car.battery_usable_kwh ?? "-"}</strong><span>kWh bruikbaar</span></div>
              <div><strong>{formatCurrency(car.price_eur)}</strong><span>vanafprijs</span></div>
            </div>
            <dl className={styles.details}>
              <div><dt>0-100</dt><dd>{car.acceleration_0_100_s ? `${car.acceleration_0_100_s}s` : "-"}</dd></div>
              <div><dt>Topsnelheid</dt><dd>{car.top_speed_kmh ? `${car.top_speed_kmh} km/u` : "-"}</dd></div>
              <div><dt>Trekgewicht</dt><dd>{car.towing_weight_braked_kg ? `${car.towing_weight_braked_kg} kg` : "-"}</dd></div>
              <div><dt>Bagage</dt><dd>{car.boot_space_liters ? `${car.boot_space_liters} L` : "-"}</dd></div>
            </dl>
            <div className={styles.cardActions}>
              <button onClick={() => toggleCompare(car.external_id)}>{selected.includes(car.external_id) ? "Verwijder" : "Vergelijk"}</button>
              <Link className={styles.link} href={getVehiclePath(car)}>Bekijk auto</Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
