import { FOTOS_CON_WEBP } from "./fotos-webp"

/**
 * La versión WebP de una foto del repo, si existe; si no, la misma ruta.
 *
 * Las rutas de las fotos vienen de la base ("/products/cafe.png") y ahí se
 * quedan: la tarjeta que se comparte por WhatsApp sigue usando el PNG, que
 * WhatsApp muestra siempre. Las pantallas piden el WebP, que pesa diez veces
 * menos (367 KB -> 40 KB la foto de un abasto).
 *
 * Solo cambia las que están en la lista que genera `scripts/a-webp.mjs`: una
 * foto nueva que no pasó por el script se pide tal cual, en vez de romperse.
 * Las que sube el panel ya vienen en WebP y no pasan por aquí.
 */
export function fotoLigera(src: string | null | undefined): string | null | undefined {
  if (!src || !FOTOS_CON_WEBP.has(src)) return src
  return src.replace(/\.png$/, ".webp")
}
