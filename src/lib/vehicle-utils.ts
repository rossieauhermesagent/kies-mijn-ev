import type { EVVehicle } from "./types";

export type BuyerPreset = "all" | "family" | "budget" | "range" | "towing" | "fastcharge" | "business";

export const buyerPresets: Array<{ id: BuyerPreset; label: string; description: string }> = [
  { id: "all", label: "Alles", description: "Alle elektrische auto's" },
  { id: "family", label: "Gezinsauto", description: "5 zitplaatsen, veel bagage en bruikbare actieradius" },
  { id: "budget", label: "Goedkoopste EV's", description: "Onder €35.000, handig voor instap of tweede auto" },
  { id: "range", label: "Veel actieradius", description: "Minimaal 450 km praktijkbereik" },
  { id: "towing", label: "Caravan/aanhanger", description: "Trekgewicht vanaf 1.000 kg" },
  { id: "fastcharge", label: "Snel laden", description: "Hoge snellaadsnelheid voor lange ritten" },
  { id: "business", label: "Zakelijk interessant", description: "Beschikbaar, efficiënt en onder €60.000" },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function vehicleSlug(vehicle: Pick<EVVehicle, "external_id" | "full_name" | "slug">) {
  return `${vehicle.external_id}-${slugify(vehicle.full_name || vehicle.slug)}`;
}

export function getVehiclePath(vehicle: Pick<EVVehicle, "external_id" | "full_name" | "slug">) {
  return `/autos/${vehicleSlug(vehicle)}`;
}

export function normaliseAvailability(value: string | null) {
  const text = (value ?? "").toLowerCase();
  if (!text) return "unknown";
  if (text.includes("discontinued") || text.includes("niet meer") || text.includes("archief")) return "discontinued";
  if (text.includes("vanaf")) return "upcoming";
  if (text.includes("bestelbaar") || text.includes("leverbaar")) return "available";
  return "other";
}

function normaliseImageUrl(url: string) {
  if (url.includes("/crop/")) return url.replace(/\/crop\/\d+x\d+\//, "/img/");
  return url;
}

function fallbackImages(vehicle: Pick<EVVehicle, "make" | "model" | "variant" | "full_name">) {
  const query = encodeURIComponent(`${vehicle.make} ${vehicle.model} ${vehicle.variant ?? ""} electric car`.replace(/\s+/g, " ").trim());
  return Array.from({ length: 5 }, (_, index) => `https://source.unsplash.com/1600x1000/?${query}&sig=${index + 1}`);
}

export function getVehicleImages(vehicle: Pick<EVVehicle, "image_url" | "image_urls" | "make" | "model" | "variant" | "full_name">) {
  const imported = [...(vehicle.image_urls ?? []), vehicle.image_url]
    .filter(Boolean)
    .map((url) => normaliseImageUrl(url as string));
  return [...new Set([...imported, ...fallbackImages(vehicle)])].slice(0, Math.max(5, imported.length));
}

export function getPrimaryImage(vehicle: Pick<EVVehicle, "image_url" | "image_urls" | "make" | "model" | "variant" | "full_name">) {
  return getVehicleImages(vehicle)[0];
}

export function matchesBuyerPreset(vehicle: EVVehicle, preset: BuyerPreset) {
  if (preset === "all") return true;
  if (preset === "family") return (vehicle.seats ?? 0) >= 5 && (vehicle.boot_space_liters ?? 0) >= 450 && (vehicle.range_real_km ?? 0) >= 300;
  if (preset === "budget") return (vehicle.price_eur ?? Infinity) <= 35000;
  if (preset === "range") return (vehicle.range_real_km ?? 0) >= 450;
  if (preset === "towing") return Boolean(vehicle.towbar_possible || (vehicle.towing_weight_braked_kg ?? 0) >= 1000);
  if (preset === "fastcharge") return (vehicle.fastcharge_speed_kmh ?? 0) >= 600 || (vehicle.fastcharge_speed_avg_kw ?? 0) >= 120;
  if (preset === "business") return normaliseAvailability(vehicle.availability) !== "discontinued" && (vehicle.price_eur ?? Infinity) <= 60000 && (vehicle.efficiency_wh_per_km ?? Infinity) <= 180;
  return true;
}

export function formatCurrency(value: number | null) {
  return value ? new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value) : "-";
}
