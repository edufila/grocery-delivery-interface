import type { MetadataRoute } from "next"

/**
 * Hace la app instalable en la pantalla de inicio. Para un delivery importa
 * más de lo que parece: el shopper la abre decenas de veces por turno, y en
 * modo standalone no tiene la barra del navegador comiéndose la pantalla.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gran Abasto Girasol",
    short_name: "Girasol",
    description: "Pide tus víveres y recíbelos en casa.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#059669",
    lang: "es",
    orientation: "portrait",
    icons: [
      // El SVG escala a cualquier tamaño; el png de 180 lo usa iOS.
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  }
}
