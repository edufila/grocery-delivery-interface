import { createClient as crear } from "@supabase/supabase-js"

import { supabaseAnonKey, supabaseUrl } from "./config"

/**
 * Cliente de Supabase sin sesión, para datos que ve cualquiera: abastos, tasa.
 *
 * El de `server.ts` lee las cookies, y leer cookies obliga a Next a armar la
 * página de nuevo en cada visita. Para una pantalla que no muestra nada de la
 * persona -- el inicio: lo personal lo pinta el teléfono -- eso es pagar el
 * viaje a Supabase en cada carga por datos que cambian una vez al día.
 *
 * Nunca para nada que dependa de quién mira: sin sesión, la RLS lo trata como
 * anónimo y devuelve solo lo público.
 */
export function crearClientePublico() {
  return crear(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
