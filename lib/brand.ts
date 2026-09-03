/**
 * El nombre de la plataforma, en un solo lugar.
 *
 * Estaba escrito "Gran Abasto Girasol" en trece pantallas, pero ese es uno de
 * los locales que reparten, no la app: hay más de uno y va a haber otros. El
 * cliente entra a la plataforma y desde ahí elige el abasto.
 *
 * Para cambiarlo, cambia estas dos líneas y nada más.
 */
export const APP_NAME = "Abasto"

/** Para la pantalla de inicio del teléfono, donde no entran nombres largos. */
export const APP_SHORT_NAME = "Abasto"

/**
 * De dónde se sirve la app. Solo hace falta para armar las direcciones
 * absolutas de la tarjeta que se ve al compartir el link: WhatsApp y compañía
 * no aceptan rutas sueltas.
 *
 * Vercel expone el dominio de cada despliegue en VERCEL_PROJECT_PRODUCTION_URL,
 * así que al cambiar de dominio esto se acomoda solo. NEXT_PUBLIC_SITE_URL
 * manda por encima, por si algún día hay dominio propio.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")

/** Título de pestaña: "Perfil · Abasto". */
export function pageTitle(section: string) {
  return `${section} · ${APP_NAME}`
}
