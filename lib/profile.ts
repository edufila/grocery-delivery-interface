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

/**
 * "María González Pérez" -> "María". El shopper solo necesita saber a quién
 * saludar en la puerta: el apellido completo del cliente no le hace falta y
 * queda por escrito en la pantalla de cualquiera que le vea el teléfono.
 */
export function firstName(full: string | null | undefined) {
  const first = (full ?? "").trim().split(/\s+/)[0]
  return first || null
}

/** "1990-04-23" -> "23/04/1990". Evita el Date para no arrastrar zona horaria. */
export function formatBirthDate(value: string | null) {
  if (!value) return null
  const [year, month, day] = value.split("-")
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

/**
 * El enlace para escribirle por WhatsApp a un teléfono venezolano, o null si el
 * número no alcanza para armarlo.
 *
 * WhatsApp pide el número internacional sin ceros ni signos: 0414-123.45.67 es
 * 584141234567. Aquí casi todo se coordina por ahí, y llamar gasta saldo.
 *
 * Acepta como la gente lo escribe: con 0 adelante, con +58, con 58, o solo los
 * diez dígitos que empiezan en 4.
 */
export function enlaceWhatsApp(telefono: string | null | undefined) {
  let digitos = (telefono ?? "").replace(/\D/g, "")
  if (digitos.startsWith("0058")) digitos = digitos.slice(2)
  if (digitos.startsWith("58") && digitos.length === 12) return `https://wa.me/${digitos}`
  if (digitos.startsWith("0") && digitos.length === 11) return `https://wa.me/58${digitos.slice(1)}`
  if (digitos.length === 10) return `https://wa.me/58${digitos}`
  return null
}
