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
    /**
     * Estos dos son los únicos colores de la app que no salen de `globals.css`:
     * los lee el sistema operativo, no el navegador, así que hay que repetirlos
     * a mano y se quedan viejos sin que nada avise. De hecho pasó: el tema
     * seguía siendo el verde de antes de cambiar la paleta, así que la barra de
     * estado no combinaba con la app.
     *
     * El fondo es el de las pantallas. Con blanco, al abrir la app instalada se
     * veía un destello antes de pintar.
     *
     * Si se vuelve a tocar la paleta, hay que actualizarlos aquí.
     */
    background_color: "#f6f4f1",
    theme_color: "#067e42",
    lang: "es",
    orientation: "portrait",
    icons: [
      /**
       * Android pide un png de 192 y otro de 512 para considerar la app
       * instalable; con solo el SVG no ofrecía instalarla.
       *
       * SIN "maskable", y eso está medido. Un icono maskable lo recorta el
       * lanzador con la forma del sistema, y solo garantiza el 80% del centro:
       * el 10% de cada lado se puede ir. La cesta de este icono llega casi al
       * borde -- queda a menos de ese 10% por los cuatro lados -- así que
       * declararlo maskable hacía que Android le cortara los bordes al dibujo.
       *
       * Sin la declaración, el lanzador lo muestra entero dentro de su propia
       * forma. Se ve un poco más chico y no tan "nativo", pero se ve completo,
       * que es lo que importa.
       *
       * Para tenerlo maskable habría que generar una versión aparte con el
       * mismo dibujo centrado sobre más verde -- el original no se toca, solo
       * se le agrega margen. Es una decisión de quien hizo el icono.
       */
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  }
}
