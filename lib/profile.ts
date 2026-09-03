export type Profile = {
  id: string
  full_name: string | null
  birth_date: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

/** Un perfil está completo cuando tiene lo mínimo para operar un pedido. */
export function isProfileComplete(profile: Profile | null) {
  return Boolean(profile?.full_name && profile?.phone)
}

/** "1990-04-23" -> "23/04/1990". Evita el Date para no arrastrar zona horaria. */
export function formatBirthDate(value: string | null) {
  if (!value) return null
  const [year, month, day] = value.split("-")
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}
