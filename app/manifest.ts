import type { MetadataRoute } from "next"

import { APP_NAME, APP_SHORT_NAME } from "@/lib/brand"

/**
 * Hace la app instalable en la pantalla de inicio. Para un delivery importa
 * más de lo que parece: el shopper la abre decenas de veces por turno, y en
 * modo standalone no tiene la barra del navegador comiéndose la pantalla.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: "Pide tus víveres y recíbelos en casa.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#059669",
    lang: "es",
    orientation: "portrait",
    icons: [
      /**
       * Android pide un png de 192 y otro de 512 para considerar la app
       * instalable; con solo el SVG no ofrecía instalarla. "maskable" es para
       * que el lanzador la recorte con la forma del sistema en vez de dejar el
       * cuadrado pegado sobre un fondo blanco.
       */
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
