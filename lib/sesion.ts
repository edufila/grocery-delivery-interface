import type { SupabaseClient, User } from "@supabase/supabase-js"

/**
 * Quién tiene la sesión abierta en este teléfono, sin preguntarle al servidor.
 *
 * `getUser()` va a Supabase cada vez que se llama. En las pantallas del
 * teléfono eso solo sirve para decidir qué mostrar, y el inicio lo llamaba
 * desde cinco componentes a la vez: cinco viajes iguales en la primera
 * pantalla, con datos móviles. La sesión ya está guardada y se lee sin red.
 *
 * No es menos seguro: lo que importa -- qué pedidos se leen, quién puede
 * pagar, tomar o entregar -- lo sigue validando la base con RLS, que no confía
 * en lo que diga el teléfono. En el servidor se sigue usando `getUser()`.
 */
export async function usuarioEnTelefono(supabase: SupabaseClient): Promise<User | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user ?? null
}
