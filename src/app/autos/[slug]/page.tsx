/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { EVVehicle } from "@/lib/types";
import { formatCurrency, getVehicleImages, vehicleSlug } from "@/lib/vehicle-utils";
import styles from "../../page.module.css";

type PageProps = { params: Promise<{ slug: string }> };

async function getVehicle(slug: string) {
  const externalId = Number(slug.split("-")[0]);
  if (!externalId) return null;
  const { data, error } = await supabase.from("ev_vehicles").select("*").eq("external_id", externalId).single();
  if (error || !data) return null;
  return data as EVVehicle;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const vehicle = await getVehicle(slug);
  if (!vehicle) return { title: "EV niet gevonden | Kies Mijn EV" };
  return {
    title: `${vehicle.full_name} | Kies Mijn EV`,
    description: `${vehicle.full_name}: ${vehicle.range_real_km ?? "-"} km praktijkbereik, ${formatCurrency(vehicle.price_eur)}, ${vehicle.efficiency_wh_per_km ?? "-"} Wh/km.`,
  };
}

export default async function VehiclePage({ params }: PageProps) {
  const { slug } = await params;
  const vehicle = await getVehicle(slug);
  if (!vehicle) notFound();

  const canonicalSlug = vehicleSlug(vehicle);
  const images = getVehicleImages(vehicle);

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/">← Terug naar alle EV&apos;s</Link>
      <section className={styles.vehicleHero}>
        <div>
          <p className={styles.eyebrow}>{vehicle.make}</p>
          <h1>{vehicle.full_name}</h1>
          <p className={styles.lead}>
            Praktische EV-specificaties zonder doorverwijzing naar externe bron. Gebruik deze pagina om bereik,
            prijs, laden, trekgewicht en bruikbaarheid snel te beoordelen.
          </p>
          {canonicalSlug !== slug && <Link href={`/autos/${canonicalSlug}`}>Canonieke URL bekijken</Link>}
        </div>
        <div className={styles.stats}>
          <strong>{vehicle.range_real_km ?? "-"}</strong><span>km real range</span>
          <strong>{formatCurrency(vehicle.price_eur)}</strong><span>vanafprijs</span>
        </div>
      </section>

      <section className={styles.gallery} aria-label={`Afbeeldingen van ${vehicle.full_name}`}>
        {images.slice(0, 5).map((image, index) => (
          <img src={image} alt={`${vehicle.full_name} afbeelding ${index + 1}`} key={image} />
        ))}
      </section>

      <section className={styles.explainerGrid}>
        <article>
          <h2>Actieradius in de praktijk</h2>
          <p>
            De praktijkrange is vaak nuttiger dan WLTP omdat je hiermee realistischer plant voor snelweg,
            kou en dagelijks gebruik. Deze auto komt uit op ongeveer {vehicle.range_real_km ?? "-"} km.
          </p>
        </article>
        <article>
          <h2>Verbruik</h2>
          <p>
            {vehicle.efficiency_wh_per_km ?? "-"} Wh/km geeft aan hoeveel energie de auto per kilometer gebruikt.
            Lager is zuiniger en helpt bij lagere laadkosten.
          </p>
        </article>
        <article>
          <h2>Laden</h2>
          <p>
            AC laden: {vehicle.charge_power_ac_kw ?? "-"} kW. Snelladen: {vehicle.fastcharge_speed_kmh ?? "-"} km/u.
            Dit is belangrijk als je vaak lange ritten rijdt.
          </p>
        </article>
        <article>
          <h2>Praktisch gebruik</h2>
          <p>
            Zitplaatsen: {vehicle.seats ?? "-"}. Bagage: {vehicle.boot_space_liters ?? "-"} liter.
            Trekgewicht: {vehicle.towing_weight_braked_kg ?? "-"} kg.
          </p>
        </article>
      </section>

      <section className={styles.specSheet}>
        <h2>Specificaties</h2>
        <dl className={styles.details}>
          <div><dt>Beschikbaarheid</dt><dd>{vehicle.availability ?? "-"}</dd></div>
          <div><dt>Batterij bruikbaar</dt><dd>{vehicle.battery_usable_kwh ?? "-"} kWh</dd></div>
          <div><dt>WLTP range</dt><dd>{vehicle.wltp_range_km ?? "-"} km</dd></div>
          <div><dt>0-100 km/u</dt><dd>{vehicle.acceleration_0_100_s ?? "-"} s</dd></div>
          <div><dt>Topsnelheid</dt><dd>{vehicle.top_speed_kmh ?? "-"} km/u</dd></div>
          <div><dt>Aandrijving</dt><dd>{vehicle.drive ?? "-"}</dd></div>
          <div><dt>Carrosserie</dt><dd>{vehicle.body_type ?? "-"}</dd></div>
          <div><dt>Segment</dt><dd>{vehicle.segment ?? "-"}</dd></div>
        </dl>
      </section>
    </main>
  );
}
