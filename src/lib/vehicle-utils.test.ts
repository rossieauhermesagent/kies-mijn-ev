import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getPrimaryImage,
  getVehicleImages,
  getVehiclePath,
  matchesBuyerPreset,
  normaliseAvailability,
  vehicleSlug,
} from "./vehicle-utils";
import type { EVVehicle } from "./types";

const baseVehicle: EVVehicle = {
  id: "1",
  external_id: 1234,
  slug: "Tesla-Model-Y-Long-Range-AWD",
  source_url: "https://ev-database.org/nl/auto/1234/Tesla-Model-Y-Long-Range-AWD",
  data_source: "ev-database.org/nl-live",
  availability: "Bestelbaar sinds januari 2026",
  make: "Tesla",
  model: "Model Y",
  variant: "Long Range AWD",
  full_name: "Tesla Model Y Long Range AWD",
  image_url: "https://example.com/main.jpg",
  image_urls: ["https://example.com/one.jpg", "https://example.com/two.jpg"],
  price_eur: 52990,
  lease_price_eur_month: null,
  battery_usable_kwh: 75,
  battery_nominal_kwh: null,
  range_real_km: 455,
  efficiency_wh_per_km: 165,
  wltp_range_km: 533,
  acceleration_0_100_s: 5,
  top_speed_kmh: 217,
  drive: "AWD",
  seats: 5,
  fastcharge_speed_avg_kw: 125,
  fastcharge_speed_kmh: 750,
  charge_power_ac_kw: 11,
  charge_time_ac: "8u15m",
  plug_type: "Type 2 CCS",
  curb_weight_kg: 1995,
  gross_weight_kg: null,
  towing_weight_braked_kg: 1600,
  towing_weight_unbraked_kg: 750,
  towbar_possible: true,
  roof_load_kg: 75,
  boot_space_liters: 854,
  boot_space_max_liters: 2158,
  v2l_supported: false,
  body_type: "SUV",
  segment: "D - Large",
  raw_specs: {},
  last_scraped_at: "2026-06-02T08:12:45.000Z",
  created_at: "2026-06-02T08:12:45.000Z",
  updated_at: "2026-06-02T08:12:45.000Z",
};

describe("vehicle utilities", () => {
  it("creates internal vehicle paths instead of source links", () => {
    assert.equal(vehicleSlug(baseVehicle), "1234-tesla-model-y-long-range-awd");
    assert.equal(getVehiclePath(baseVehicle), "/autos/1234-tesla-model-y-long-range-awd");
  });

  it("normalises availability into filter groups", () => {
    assert.equal(normaliseAvailability("Bestelbaar sinds januari 2026"), "available");
    assert.equal(normaliseAvailability("Bestelbaar vanaf juli 2026"), "upcoming");
    assert.equal(normaliseAvailability("discontinued"), "discontinued");
  });

  it("returns at least five stable image candidates for every vehicle", () => {
    const images = getVehicleImages(baseVehicle);
    assert.ok(images.length >= 5);
    assert.equal(images[0], "https://example.com/one.jpg");
    assert.equal(new Set(images).size, images.length);
  });

  it("uses a deterministic fallback as primary image when imported images are missing", () => {
    const car = { ...baseVehicle, image_url: null, image_urls: [] };
    assert.ok(getPrimaryImage(car).includes("source.unsplash.com"));
    assert.equal(getVehicleImages(car).length, 5);
  });

  it("upgrades EV Database crop image URLs to higher resolution originals", () => {
    const car = {
      ...baseVehicle,
      image_url: "https://ev-database.org/img/auto/Tesla_Model_Y/Tesla_Model_Y-01.jpg",
      image_urls: ["https://ev-database.org/crop/480x320/auto/Tesla_Model_Y/Tesla_Model_Y-01.jpg"],
    };
    assert.equal(getVehicleImages(car)[0], "https://ev-database.org/img/auto/Tesla_Model_Y/Tesla_Model_Y-01.jpg");
  });

  it("matches buyer intent presets", () => {
    assert.equal(matchesBuyerPreset(baseVehicle, "family"), true);
    assert.equal(matchesBuyerPreset(baseVehicle, "towing"), true);
    assert.equal(matchesBuyerPreset(baseVehicle, "budget"), false);
    assert.equal(matchesBuyerPreset({ ...baseVehicle, price_eur: 28900 }, "budget"), true);
  });
});
