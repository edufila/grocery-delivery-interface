/**
 * Genera los íconos de la app. Los que venían eran el logo negro de la
 * plantilla de v0, que es lo que quedaba en la pantalla de inicio del teléfono.
 *
 *   node scripts/make-icons.mjs
 *
 * Para probar otros diseños antes de cambiar este, está
 * `scripts/muestras-icono.mjs`, que escribe variantes en una carpeta aparte.
 */
import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import { BASE, enElipse, enCirculo, enRectRedondo, pintar, png } from "./png.mjs"

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public")

// Los verdes de la app, y frutas en cálidos para que resalten sobre el verde.
const FONDO = [5, 150, 105] // emerald-600
const CESTA = [255, 255, 255]
const NARANJA = [249, 115, 22] // orange-500
const ROJO = [239, 68, 68] // red-500
const AMARILLO = [251, 191, 36] // amber-400

/**
 * El dibujo entero cabe a menos de 190 del centro: entra en el círculo seguro
 * del 80% que recortan los lanzadores de Android, así que no se le corta nada.
 *
 * Una cesta y no el girasol del abasto: la app ya reparte de varias tiendas, y
 * el ícono es de la plataforma, no de una de ellas.
 */
const SUBIR = 28

/** Color de un punto del dibujo, en coordenadas de 0 a 512. */
function colorEn(x, yBruto) {
  const y = yBruto + SUBIR

  // El borde de la cesta y su cuerpo tapan lo que haya detrás.
  if (enRectRedondo(x, y, 118, 268, 394, 314, 23)) return CESTA

  if (y > 310 && enElipse(x, y, 256, 300, 118, 106)) {
    // Tres ranuras al frente para que se lea como cesta y no como un tazón.
    for (const cx of [200, 256, 312]) {
      if (enRectRedondo(x, y, cx - 9, 330, cx + 9, 388, 9)) return FONDO
    }
    return CESTA
  }

  // Las frutas asoman por encima del borde.
  if (enCirculo(x, y, 198, 234, 46)) return NARANJA
  if (enCirculo(x, y, 264, 210, 43)) return ROJO
  if (enCirculo(x, y, 322, 238, 44)) return AMARILLO

  return FONDO
}

// ------------------------------------------------------------------ generar

const salidas = [
  ["apple-icon.png", 180], // el que usa iOS en la pantalla de inicio
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["icon-light-32x32.png", 32],
  ["icon-dark-32x32.png", 32],
]

for (const [nombre, size] of salidas) {
  writeFileSync(join(PUBLIC, nombre), png(size, pintar(size, colorEn)))
  console.log(`${nombre} (${size}px)`)
}

/**
 * La versión vectorial, para las pestañas del navegador. Es el mismo dibujo
 * que `colorEn`, con la resta de SUBIR ya aplicada a cada coordenada.
 */
const ranuras = [200, 256, 312]
  .map(
    (cx) =>
      `  <rect x="${cx - 9}" y="${330 - SUBIR}" width="18" height="58" rx="9" fill="rgb(${FONDO})" />`,
  )
  .join("\n")

writeFileSync(
  join(PUBLIC, "icon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BASE} ${BASE}" width="${BASE}" height="${BASE}" role="img" aria-label="Cesta de compras">
  <defs>
    <clipPath id="bajoElBorde">
      <rect x="0" y="${310 - SUBIR}" width="${BASE}" height="${BASE}" />
    </clipPath>
  </defs>
  <rect width="${BASE}" height="${BASE}" fill="rgb(${FONDO})" />
  <circle cx="198" cy="${234 - SUBIR}" r="46" fill="rgb(${NARANJA})" />
  <circle cx="264" cy="${210 - SUBIR}" r="43" fill="rgb(${ROJO})" />
  <circle cx="322" cy="${238 - SUBIR}" r="44" fill="rgb(${AMARILLO})" />
  <ellipse cx="256" cy="${300 - SUBIR}" rx="118" ry="106" fill="rgb(${CESTA})" clip-path="url(#bajoElBorde)" />
${ranuras}
  <rect x="118" y="${268 - SUBIR}" width="276" height="46" rx="23" fill="rgb(${CESTA})" />
</svg>
`,
)
console.log("icon.svg")
