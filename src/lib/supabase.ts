"use client";
import { createClient } from "@supabase/supabase-js";
// Anon key only. RLS + security-definer functions enforce all permissions; no service key in the browser.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "missing-key",
);
export const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
