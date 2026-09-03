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

/** Título de pestaña: "Perfil · Abasto". */
export function pageTitle(section: string) {
  return `${section} · ${APP_NAME}`
}
