"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { EVVehicle } from "@/lib/types";
import styles from "./page.module.css";

const currency = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function unique(values: Array<string | null>) {
  return [...new Set(values.filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "nl"));
}

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

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error: requestError } = await supabase
        .from("ev_vehicles")
        .select("*")
        .order("range_real_km", { ascending: false, nullsFirst: false })
        .limit(1000);

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
      if (availability !== "all" && car.availability !== availability) return false;
      if (bodyType !== "all" && car.body_type !== bodyType) return false;
      if (maxPrice !== "all" && (!car.price_eur || car.price_eur > Number(maxPrice))) return false;
      if (minRange !== "all" && (!car.range_real_km || car.range_real_km < Number(minRange))) return false;
      if (towbarOnly && !car.towbar_possible && !car.towing_weight_braked_kg) return false;
      return true;
    });

    result.sort((a, b) => {
      if (sort === "price_asc") return (a.price_eur ?? Infinity) - (b.price_eur ?? Infinity);
      if (sort === "efficiency_asc") return (a.efficiency_wh_per_km ?? Infinity) - (b.efficiency_wh_per_km ?? Infinity);
      if (sort === "battery_desc") return (b.battery_usable_kwh ?? 0) - (a.battery_usable_kwh ?? 0);
      return (b.range_real_km ?? 0) - (a.range_real_km ?? 0);
    });

    return result;
  }, [vehicles, query, make, availability, bodyType, maxPrice, minRange, towbarOnly, sort]);

  const makes = unique(vehicles.map((vehicle) => vehicle.make));
  const availabilityOptions = unique(vehicles.map((vehicle) => vehicle.availability));
  const bodyTypes = unique(vehicles.map((vehicle) => vehicle.body_type));

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Kies Mijn EV</p>
          <h1>Vind een elektrische auto op echte actieradius, prijs en praktische bruikbaarheid.</h1>
          <p className={styles.lead}>
            Database met EV-specificaties uit ev-database.nl. Filter op bereik, budget, merk, beschikbaarheid,
            carrosserie en trekhaakgeschiktheid.
          </p>
        </div>
        <div className={styles.stats}>
          <strong>{vehicles.length}</strong>
          <span>EV&apos;s geïmporteerd</span>
          <strong>{filtered.length}</strong>
          <span>resultaten met filters</span>
        </div>
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
            <option value="all">Alles</option>
            {availabilityOptions.map((option) => <option key={option}>{option}</option>)}
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
          </select>
        </label>
        <label className={styles.checkbox}>
          <input type="checkbox" checked={towbarOnly} onChange={(event) => setTowbarOnly(event.target.checked)} />
          Trekhaak mogelijk
        </label>
      </section>

      {loading && <p className={styles.message}>EV database laden...</p>}
      {error && <p className={styles.error}>Supabase fout: {error}</p>}

      <section className={styles.grid}>
        {filtered.map((car) => (
          <article className={styles.card} key={car.external_id}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.make}>{car.make}</p>
                <h2>{car.model}</h2>
                {car.variant && <p className={styles.variant}>{car.variant}</p>}
              </div>
              {car.availability && <span className={styles.badge}>{car.availability}</span>}
            </div>
            <div className={styles.metrics}>
              <div><strong>{car.range_real_km ?? "-"}</strong><span>km real range</span></div>
              <div><strong>{car.efficiency_wh_per_km ?? "-"}</strong><span>Wh/km</span></div>
              <div><strong>{car.battery_usable_kwh ?? "-"}</strong><span>kWh bruikbaar</span></div>
              <div><strong>{car.price_eur ? currency.format(car.price_eur) : "-"}</strong><span>vanafprijs</span></div>
            </div>
            <dl className={styles.details}>
              <div><dt>0-100</dt><dd>{car.acceleration_0_100_s ? `${car.acceleration_0_100_s}s` : "-"}</dd></div>
              <div><dt>Topsnelheid</dt><dd>{car.top_speed_kmh ? `${car.top_speed_kmh} km/u` : "-"}</dd></div>
              <div><dt>Trekgewicht</dt><dd>{car.towing_weight_braked_kg ? `${car.towing_weight_braked_kg} kg` : "-"}</dd></div>
              <div><dt>Bagage</dt><dd>{car.boot_space_liters ? `${car.boot_space_liters} L` : "-"}</dd></div>
            </dl>
            <a className={styles.link} href={car.source_url} target="_blank" rel="noreferrer">Bekijk bron</a>
          </article>
        ))}
      </section>
    </main>
  );
}
