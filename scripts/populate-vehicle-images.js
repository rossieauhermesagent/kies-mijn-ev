#!/usr/bin/env node

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function normaliseImageUrl(url) {
  if (!url) return url;
  if (url.includes("/crop/")) return url.replace(/\/crop\/\d+x\d+\//, "/img/");
  return url;
}

function imageCandidates(vehicle) {
  const seen = new Set();
  const urls = [];
  for (const url of [...(vehicle.image_urls || []), vehicle.image_url]) {
    if (url && !url.includes("source.unsplash.com") && !seen.has(url)) {
      seen.add(url);
      urls.push(normaliseImageUrl(url));
    }
  }
  return urls;
}

async function main() {
  let from = 0;
  const pageSize = 500;
  let updated = 0;

  while (true) {
    const { data, error } = await supabase
      .from("ev_vehicles")
      .select("external_id,make,model,variant,image_url,image_urls")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const vehicle of data) {
      const image_urls = imageCandidates(vehicle);
      const image_url = image_urls[0] || vehicle.image_url;
      const { error: updateError } = await supabase
        .from("ev_vehicles")
        .update({ image_url, image_urls })
        .eq("external_id", vehicle.external_id);
      if (updateError) throw updateError;
      updated += 1;
    }

    from += pageSize;
  }

  console.log(`Updated image_urls for ${updated} vehicles`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
