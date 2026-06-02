import { createClient } from "@supabase/supabase-js";
import type { EVVehicle } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabase = createClient<{ public: { Tables: { ev_vehicles: { Row: EVVehicle } } } }>(
  supabaseUrl,
  supabaseAnonKey,
);
