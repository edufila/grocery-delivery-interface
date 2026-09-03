import { createBrowserClient } from "@supabase/ssr"

import { supabaseAnonKey, supabaseUrl } from "./config"

/** Cliente de Supabase para componentes que corren en el navegador. */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
