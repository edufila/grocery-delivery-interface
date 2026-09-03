/**
 * Sanea el parámetro `next` del login para evitar redirecciones abiertas.
 * Solo se aceptan rutas internas ("/checkout"), nunca URLs externas
 * ("//evil.com" y "/\evil.com" son protocol-relative en los navegadores).
 */
export function safeNextPath(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback
  if (!value.startsWith("/")) return fallback
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback
  return value
}
