import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { supabaseAnonKey, supabaseUrl } from "./config"

/**
 * Cliente de Supabase para Server Components, Route Handlers y Server Actions.
 * Lee y escribe la sesión en las cookies del request.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Los Server Components no pueden escribir cookies. No es un problema:
          // el middleware ya refresca la sesión en cada request.
        }
      },
    },
  })
}
