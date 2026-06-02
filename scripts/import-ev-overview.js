#!/usr/bin/env node

const { createClient } = require("@supabase/supabase-js");
const cheerio = require("cheerio");
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LIST_URL = "https://ev-database.org/nl/vergelijk/nieuwste-elektrische-auto";
const BASE_URL = "https://ev-database.org";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const cleanText = (value) => (value || "").replace(/\s+/g, " ").trim();
const intNum = (value) => {
  if (!value) return null;
  const match = String(value).replace(/\./g, "").replace(/,/g, ".").match(/-?\d+(?:\.\d+)?/);
  return match ? Math.round(Number(match[0])) : null;
};
const num = (value) => {
  if (!value) return null;
  const match = String(value).replace(/\./g, "").replace(/,/g, ".").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};

function isBlocked(html) {
  const text = html.slice(0, 5000).toLowerCase();
  return text.includes("request blocked") || text.includes("anomalies detected") || text.includes("officialdatapartner") || text.includes("too many requests");
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "nl-NL,nl;q=0.9,en;q=0.7",
    },
  });
  const html = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (isBlocked(html)) throw new Error("Blocked response; aborting overview import");
  return html;
}

function splitName(fullName, make) {
  const withoutMake = fullName.startsWith(make) ? cleanText(fullName.slice(make.length)) : fullName;
  const parts = withoutMake.split(" ").filter(Boolean);
  const model = parts.shift() || withoutMake || make;
  const variant = parts.length ? parts.join(" ") : null;
  return { model, variant };
}

function parseAvailability(text, classes) {
  const value = cleanText(text);
  if (/discontinued|archive|niet meer/i.test(`${value} ${classes}`)) return "discontinued";
  if (/upcoming|verwacht|vanaf|aangekondigd|bestelbaar vanaf/i.test(`${value} ${classes}`)) return value || "upcoming";
  return value || "available";
}

function absUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${BASE_URL}${path}`;
}

async function main() {
  console.log(`Fetching overview: ${LIST_URL}`);
  const html = await fetchHtml(LIST_URL);
  const $ = cheerio.load(html);
  const vehicles = [];

  $(".list-item").each((_, item) => {
    const el = $(item);
    const link = el.find('a[href*="/nl/auto/"]').first();
    const href = link.attr("href");
    const match = href && href.match(/\/nl\/auto\/(\d+)\/([^/?#]+)/);
    if (!match) return;

    const externalId = Number(match[1]);
    const slug = decodeURIComponent(match[2]);
    const make = cleanText(link.find("span").first().text()) || slug.split("-")[0];
    const fullName = cleanText(link.find(".hidden").first().text()) || cleanText(link.text()) || slug.replace(/-/g, " ");
    const { model, variant } = splitName(fullName, make);
    const availabilityEl = el.find(".availability").first();
    const towWeight = intNum(el.find(".towweight.hidden").first().text() || el.find(".towweight_p").first().text());

    vehicles.push({
      external_id: externalId,
      slug,
      source_url: absUrl(href),
      data_source: "ev-database.org/nl-overview",
      availability: parseAvailability(availabilityEl.text(), availabilityEl.attr("class") || ""),
      make,
      model,
      variant,
      full_name: fullName,
      image_url: absUrl(el.find("img").first().attr("src")),
      price_eur: intNum(el.find(".pricesort").first().text() || el.find(".price_buy").first().text()),
      lease_price_eur_month: null,
      battery_usable_kwh: num(el.find(".battery.hidden").first().text() || el.find(".battery_p").first().text()),
      battery_nominal_kwh: null,
      range_real_km: intNum(el.find(".erange_real").first().text()),
      efficiency_wh_per_km: intNum(el.find(".efficiency").first().text()),
      wltp_range_km: null,
      acceleration_0_100_s: num(el.find(".acceleration.hidden").first().text() || el.find(".acceleration_p").first().text()),
      top_speed_kmh: null,
      drive: cleanText(el.find('.icons-row-1 [data-tooltip*="aangedreven"]').first().attr("data-tooltip")),
      seats: intNum(el.find('[class*="seats-"]').first().parent().text()),
      fastcharge_speed_avg_kw: intNum(el.find(".fastcharge_speed.hidden").first().text() || el.find(".fastcharge_speed_print").first().text()),
      fastcharge_speed_kmh: null,
      charge_power_ac_kw: null,
      charge_time_ac: null,
      plug_type: null,
      curb_weight_kg: intNum(el.find(".weight.hidden").first().text() || el.find(".weight_p").first().text()),
      gross_weight_kg: null,
      towing_weight_braked_kg: towWeight && towWeight > 0 ? towWeight : null,
      towing_weight_unbraked_kg: null,
      towbar_possible: towWeight && towWeight > 0 ? true : false,
      roof_load_kg: null,
      boot_space_liters: intNum(el.find(".cargosort").first().text() || el.find(".cargo").first().text()),
      boot_space_max_liters: null,
      v2l_supported: /v2xl/i.test(el.text()) || /Vehicle-2-Load/i.test(el.html() || ""),
      body_type: null,
      segment: cleanText(el.find('[class^="size-"]').first().text()) || null,
      raw_specs: {
        overview_text: cleanText(el.text()).slice(0, 2000),
      },
      last_scraped_at: new Date().toISOString(),
    });
  });

  if (!vehicles.length) throw new Error("No vehicles parsed; aborting");
  console.log(`Parsed ${vehicles.length} vehicles from overview`);

  const batchSize = 100;
  let imported = 0;
  for (let i = 0; i < vehicles.length; i += batchSize) {
    const batch = vehicles.slice(i, i + batchSize);
    const { error } = await supabase.from("ev_vehicles").upsert(batch, { onConflict: "external_id" });
    if (error) throw error;
    imported += batch.length;
    console.log(`Imported ${imported}/${vehicles.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
