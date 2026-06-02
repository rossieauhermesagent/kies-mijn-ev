#!/usr/bin/env node

const { createClient } = require("@supabase/supabase-js");
const cheerio = require("cheerio");
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = "https://ev-database.org";
const LIST_URLS = [
  "https://ev-database.org/nl/vergelijk/nieuwste-elektrische-auto",
  "https://ev-database.org/nl/vergelijk/actieradius-elektrische-auto",
  "https://ev-database.org/nl/vergelijk/energieverbruik-elektrische-auto",
  "https://ev-database.org/nl/vergelijk/alle-elektrische-auto",
];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cleanText = (value) => (value || "").replace(/\s+/g, " ").trim();
const num = (value) => {
  if (value === undefined || value === null) return null;
  const match = String(value).replace(/,/g, ".").replace(/\s/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};
const intNum = (value) => {
  const n = num(String(value).replace(/\./g, ""));
  return n === null ? null : Math.round(n);
};
const boolFromDutch = (value) => {
  const text = cleanText(value).toLowerCase();
  if (["ja", "yes", "mogelijk", "optioneel", "standard", "standaard"].some((word) => text.includes(word))) return true;
  if (["nee", "no", "niet mogelijk"].some((word) => text.includes(word))) return false;
  return null;
};

function isBlocked(html) {
  const text = html.slice(0, 5000).toLowerCase();
  return text.includes("request blocked") || text.includes("anomalies detected") || text.includes("officialdatapartner") || text.includes("too many requests");
}

async function fetchHtml(url, attempt = 1) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "nl-NL,nl;q=0.9,en;q=0.7",
    },
  });
  const html = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  if (isBlocked(html)) throw new Error(`Blocked response for ${url}`);
  return html;
}

function discoverVehicles(html) {
  const found = new Map();
  const re = /\/nl\/auto\/(\d+)\/([A-Za-z0-9._~%+-]+)|\/auto\/(\d+)\/([A-Za-z0-9._~%+-]+)/g;
  let match;
  while ((match = re.exec(html))) {
    const id = Number(match[1] || match[3]);
    const slug = decodeURIComponent(match[2] || match[4]);
    if (id && slug) found.set(id, { external_id: id, slug, url: `${BASE_URL}/nl/auto/${id}/${slug}` });
  }
  return [...found.values()];
}

function parseListCard($, id) {
  const link = $(`a[href*="/auto/${id}/"]`).first();
  const card = link.closest(".list-item, .data-table, .vehicle, .car, article, li, div");
  return cleanText(card.text());
}

function deriveName(slug, $) {
  const h1 = cleanText($("h1").first().text());
  const title = cleanText($("title").text()).replace(/\s*-\s*EV Database.*$/i, "");
  const raw = h1 || title || slug.replace(/-/g, " ");
  return raw.replace(/\s+/g, " ").trim();
}

function splitName(fullName) {
  const parts = fullName.replace(/^\d+\s+/, "").split(" ");
  const make = parts.shift() || "Unknown";
  const model = parts.shift() || make;
  const variant = parts.length ? parts.join(" ") : null;
  return { make, model, variant };
}

function collectSpecs($) {
  const specs = {};
  $("tr").each((_, tr) => {
    const cells = $(tr).find("th,td").map((__, el) => cleanText($(el).text())).get().filter(Boolean);
    if (cells.length >= 2) specs[cells[0]] = cells.slice(1).join(" ");
  });
  $(".inline_specs .item, .specs .item, .detail-data, .data-table .item, .battery .item").each((_, el) => {
    const text = cleanText($(el).text());
    const label = cleanText($(el).find("span, label, .label").last().text());
    const value = cleanText(text.replace(label, ""));
    if (label && value && label.length < 80) specs[label] = value;
  });
  return specs;
}

function findSpec(specs, includes) {
  const entry = Object.entries(specs).find(([key]) => includes.every((part) => key.toLowerCase().includes(part.toLowerCase())));
  return entry ? entry[1] : null;
}

function parseVehicle(html, discovered) {
  const $ = cheerio.load(html);
  const fullName = deriveName(discovered.slug, $);
  const { make, model, variant } = splitName(fullName);
  const bodyText = cleanText($.text());
  const specs = collectSpecs($);
  const imageUrl = $("meta[property='og:image']").attr("content") || null;
  const availability = /niet meer leverbaar|discontinued|archief/i.test(bodyText) ? "discontinued" : "available";

  const price = bodyText.match(/€\s*([0-9.]+)(?:\s|,-)/) || bodyText.match(/Prijs\s*€?\s*([0-9.]+)/i);
  const realRange = bodyText.match(/(\d+)\s*km\s*Actieradius/i) || bodyText.match(/Praktische Actieradius\s*(\d+)\s*km/i);
  const efficiency = bodyText.match(/(\d+)\s*Wh\/km\s*Verbruik/i) || bodyText.match(/Verbruik\s*(\d+)\s*Wh\/km/i);
  const battery = bodyText.match(/(\d+(?:[,.]\d+)?)\s*kWh\s*Batterij/i) || bodyText.match(/Bruikbare Batterijcapaciteit\s*(\d+(?:[,.]\d+)?)\s*kWh/i);
  const accel = bodyText.match(/(\d+(?:[,.]\d+)?)\s*sec\s*Acceleratie/i) || bodyText.match(/0\s*-\s*100\s*km\/u\s*(\d+(?:[,.]\d+)?)/i);
  const topSpeed = bodyText.match(/(\d+)\s*km\/u\s*Topsnelheid/i) || bodyText.match(/Topsnelheid\s*(\d+)\s*km\/u/i);

  const boot = findSpec(specs, ["bagage"]) || findSpec(specs, ["koffer"]);
  const bootNums = boot ? boot.match(/(\d+)(?:\s*\/\s*(\d+))?/) : null;

  return {
    external_id: discovered.external_id,
    slug: discovered.slug,
    source_url: discovered.url,
    data_source: "ev-database.org/nl-live",
    availability,
    make,
    model,
    variant,
    full_name: fullName,
    image_url: imageUrl,
    price_eur: price ? intNum(price[1]) : intNum(findSpec(specs, ["prijs"])),
    lease_price_eur_month: null,
    battery_usable_kwh: battery ? num(battery[1]) : num(findSpec(specs, ["bruikbare", "batterij"])),
    battery_nominal_kwh: num(findSpec(specs, ["nominale", "batterij"])),
    range_real_km: realRange ? intNum(realRange[1]) : intNum(findSpec(specs, ["praktische", "actieradius"])),
    efficiency_wh_per_km: efficiency ? intNum(efficiency[1]) : intNum(findSpec(specs, ["verbruik"])),
    wltp_range_km: intNum(findSpec(specs, ["wltp"])),
    acceleration_0_100_s: accel ? num(accel[1]) : num(findSpec(specs, ["acceleratie"])),
    top_speed_kmh: topSpeed ? intNum(topSpeed[1]) : intNum(findSpec(specs, ["topsnelheid"])),
    drive: findSpec(specs, ["aandrijving"]),
    seats: intNum(findSpec(specs, ["zitplaatsen"])),
    fastcharge_speed_avg_kw: intNum(findSpec(specs, ["laadvermogen", "10-80"])),
    fastcharge_speed_kmh: intNum(findSpec(specs, ["snelladen"])),
    charge_power_ac_kw: num(findSpec(specs, ["laadvermogen", "ac"])),
    charge_time_ac: findSpec(specs, ["laadtijd"]),
    plug_type: findSpec(specs, ["stekker"]),
    curb_weight_kg: intNum(findSpec(specs, ["massa", "rijklaar"])),
    gross_weight_kg: intNum(findSpec(specs, ["max", "massa"])),
    towing_weight_braked_kg: intNum(findSpec(specs, ["trekgewicht", "geremd"])),
    towing_weight_unbraked_kg: intNum(findSpec(specs, ["trekgewicht", "ongeremd"])),
    towbar_possible: boolFromDutch(findSpec(specs, ["trekhaak"])),
    roof_load_kg: intNum(findSpec(specs, ["dakbelasting"])),
    boot_space_liters: bootNums ? intNum(bootNums[1]) : null,
    boot_space_max_liters: bootNums && bootNums[2] ? intNum(bootNums[2]) : null,
    v2l_supported: boolFromDutch(findSpec(specs, ["v2l"]) || findSpec(specs, ["bidirectioneel"])),
    body_type: findSpec(specs, ["carrosserie"]) || findSpec(specs, ["segment"]),
    segment: findSpec(specs, ["segment"]),
    raw_specs: specs,
    last_scraped_at: new Date().toISOString(),
  };
}

async function main() {
  const discovered = new Map();
  for (const url of LIST_URLS) {
    try {
      console.log(`Discovering ${url}`);
      const html = await fetchHtml(url);
      for (const car of discoverVehicles(html)) discovered.set(car.external_id, car);
      await sleep(1200);
    } catch (error) {
      console.warn(`Discovery failed: ${error.message}`);
    }
  }

  const cars = [...discovered.values()].sort((a, b) => a.external_id - b.external_id);
  console.log(`Discovered ${cars.length} unique EV pages`);
  if (cars.length === 0) throw new Error("No cars discovered; aborting import");

  let imported = 0;
  for (const [index, car] of cars.entries()) {
    try {
      console.log(`[${index + 1}/${cars.length}] ${car.url}`);
      const html = await fetchHtml(car.url);
      const vehicle = parseVehicle(html, car);
      if (/request/i.test(vehicle.make) || /blocked/i.test(vehicle.model)) throw new Error("Poison blocked data detected");
      const { error } = await supabase.from("ev_vehicles").upsert(vehicle, { onConflict: "external_id" });
      if (error) throw error;
      imported += 1;
      await sleep(1600 + Math.floor(Math.random() * 2600));
    } catch (error) {
      console.warn(`Skipped ${car.external_id}: ${error.message}`);
      await sleep(5000);
    }
  }

  console.log(`Imported ${imported}/${cars.length} vehicles`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
