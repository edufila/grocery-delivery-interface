/**
 * Genera los íconos de la app. Los que venían eran el logo negro de la
 * plantilla de v0, que es lo que quedaba en la pantalla de inicio del teléfono.
 *
 * Dibuja y codifica el PNG a mano con los módulos de Node: instalar un
 * rasterizador (sharp) fallaba en esta máquina, y para un girasol de círculos
 * no hace falta.
 *
 *   node scripts/make-icons.mjs
 */
import { deflateSync } from "node:zlib"
import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public")

// Los verdes de la app, y frutas en cálidos para que resalten sobre el verde.
const FONDO = [5, 150, 105] // emerald-600
const CESTA = [255, 255, 255]
const NARANJA = [249, 115, 22] // orange-500
const ROJO = [239, 68, 68] // red-500
const AMARILLO = [251, 191, 36] // amber-400

/**
 * Todo se mide sobre un lienzo de 512 y se escala. El dibujo entero cabe a
 * menos de 190 del centro: entra en el círculo seguro del 80% que recortan los
 * lanzadores de Android, así que no se le corta nada.
 *
 * Una cesta y no el girasol del abasto: la app ya reparte de varias tiendas,
 * y el ícono es de la plataforma, no de una de ellas.
 */
const BASE = 512

/** Sube el dibujo para que quede centrado en el cuadrado. */
const SUBIR = 28

function enCirculo(x, y, cx, cy, r) {
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= r * r
}

function enElipse(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx
  const dy = (y - cy) / ry
  return dx * dx + dy * dy <= 1
}

/** Rectángulo de esquinas redondeadas: el punto se acerca al rectángulo interno. */
function enRectRedondo(x, y, x0, y0, x1, y1, r) {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r)
  const cy = Math.min(Math.max(y, y0 + r), y1 - r)
  return enCirculo(x, y, cx, cy, r)
}

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

/** Píxeles RGBA del ícono a un tamaño dado, con 4x4 muestras por píxel. */
function pintar(size) {
  const muestras = 4
  const pixels = Buffer.alloc(size * size * 4)
  const escala = BASE / size

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0

      for (let sy = 0; sy < muestras; sy++) {
        for (let sx = 0; sx < muestras; sx++) {
          const c = colorEn(
            (x + (sx + 0.5) / muestras) * escala,
            (y + (sy + 0.5) / muestras) * escala,
          )
          r += c[0]
          g += c[1]
          b += c[2]
        }
      }

      const total = muestras * muestras
      const i = (y * size + x) * 4
      pixels[i] = Math.round(r / total)
      pixels[i + 1] = Math.round(g / total)
      pixels[i + 2] = Math.round(b / total)
      // El fondo cubre el cuadrado entero: iOS y Android le ponen su recorte.
      pixels[i + 3] = 255
    }
  }

  return pixels
}

// ------------------------------------------------------------ codificar PNG

const TABLA_CRC = (() => {
  const tabla = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tabla[n] = c
  }
  return tabla
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = TABLA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(tipo, datos) {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(cuerpo))
  return Buffer.concat([largo, cuerpo, crc])
}

function png(size, pixels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  // Cada fila lleva adelante su byte de filtro; 0 es "sin filtrar".
  const filas = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const desde = y * size * 4
    filas[y * (size * 4 + 1)] = 0
    pixels.copy(filas, y * (size * 4 + 1) + 1, desde, desde + size * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(filas, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
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
  writeFileSync(join(PUBLIC, nombre), png(size, pintar(size)))
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
