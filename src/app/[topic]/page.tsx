/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { EVVehicle } from "@/lib/types";
import { formatCurrency, getPrimaryImage, getVehiclePath, matchesBuyerPreset, type BuyerPreset } from "@/lib/vehicle-utils";
import styles from "../page.module.css";

const pages: Record<string, { title: string; description: string; preset?: BuyerPreset; body?: string }> = {
  "beste-elektrische-auto": {
    title: "Beste elektrische auto's vergelijken",
    description: "EV's met sterke balans tussen praktijkbereik, prijs, efficiëntie en bruikbaarheid.",
    preset: "business",
    body: "Een goede EV is niet automatisch de auto met de grootste batterij. Let vooral op praktijkbereik, verbruik, laadsnelheid, ruimte en beschikbaarheid.",
  },
  "elektrische-auto-met-trekhaak": {
    title: "Elektrische auto met trekhaak",
    description: "Vind EV's die geschikt zijn voor aanhanger, fietsendrager of caravan.",
    preset: "towing",
    body: "Bij een EV met trekhaak is het geremde trekgewicht belangrijker dan alleen het vermogen. Controleer ook rangeverlies bij caravanritten.",
  },
  "goedkope-elektrische-auto": {
    title: "Goedkope elektrische auto's",
    description: "Betaalbare EV's onder ongeveer €35.000.",
    preset: "budget",
    body: "Goedkoop is vooral interessant als de range past bij je dagelijkse ritten en je thuis of op werk kunt laden.",
  },
  "elektrische-suv": {
    title: "Elektrische SUV's",
    description: "Ruime EV's voor gezinnen, bagage en hogere zitpositie.",
    preset: "family",
    body: "Elektrische SUV's combineren ruimte met comfort, maar verbruiken vaak meer. Vergelijk daarom altijd Wh/km en praktijkrange.",
  },
};

type PageProps = { params: Promise<{ topic: string }> };

export async function generateStaticParams() {
  return Object.keys(pages).map((topic) => ({ topic }));
}

export async function generateMetadata({ params }: PageProps) {
  const { topic } = await params;
  const page = pages[topic] ?? pages["beste-elektrische-auto"];
  return { title: `${page.title} | Kies Mijn EV`, description: page.description };
}

export default async function TopicPage({ params }: PageProps) {
  const { topic } = await params;
  const page = pages[topic] ?? pages["beste-elektrische-auto"];
  const { data } = await supabase.from("ev_vehicles").select("*").order("range_real_km", { ascending: false }).limit(500);
  const vehicles = ((data ?? []) as EVVehicle[]).filter((car) => (page.preset ? matchesBuyerPreset(car, page.preset) : true)).slice(0, 18);

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/">← Terug naar zoeken</Link>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>EV gids</p>
          <h1>{page.title}</h1>
          <p className={styles.lead}>{page.description}</p>
        </div>
      </section>
      <section className={styles.explainerGrid}>
        <article><h2>Waar moet je op letten?</h2><p>{page.body}</p></article>
        <article><h2>Gebruik Kies Mijn EV</h2><p>Open een auto voor de single vehicle pagina of ga terug naar de hoofdfilter om budget, range en merk verder te verfijnen.</p></article>
      </section>
      <section className={styles.grid}>
        {vehicles.map((car) => (
          <article className={styles.card} key={car.external_id}>
            <Link className={styles.imageLink} href={getVehiclePath(car)}><img src={getPrimaryImage(car)} alt={car.full_name} /></Link>
            <p className={styles.make}>{car.make}</p>
            <h2><Link href={getVehiclePath(car)}>{car.full_name}</Link></h2>
            <div className={styles.metrics}>
              <div><strong>{car.range_real_km ?? "-"}</strong><span>km real range</span></div>
              <div><strong>{formatCurrency(car.price_eur)}</strong><span>vanafprijs</span></div>
            </div>
            <Link className={styles.link} href={getVehiclePath(car)}>Bekijk auto</Link>
          </article>
        ))}
      </section>
    </main>
  );
}
