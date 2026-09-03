// Credenciales de Supabase. Se leen de .env.local (ver .env.local.example).
// Next las reemplaza en tiempo de build, por eso hay que accederlas literalmente.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

// Mientras no estén cargadas, la app sigue funcionando: el login muestra un
// aviso de configuración en vez de romperse, y el middleware no bloquea nada.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
