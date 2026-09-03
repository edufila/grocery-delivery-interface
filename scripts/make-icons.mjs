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

// Los mismos verdes y ámbares que usa la app.
const FONDO = [5, 150, 105] // emerald-600
const PETALO = [251, 191, 36] // amber-400
const CENTRO = [120, 53, 15] // amber-900

/**
 * Todo se mide sobre un lienzo de 512 y se escala. Los pétalos llegan hasta
 * 194 de 256: entran en el círculo seguro del 80% que recortan los lanzadores
 * de Android, así que no se le corta nada al ícono.
 */
const BASE = 512
const PETALOS = 8
const DIST_PETALO = 118
const RADIO_PETALO = 76
const RADIO_CENTRO = 86

/** Color de un punto del dibujo, en coordenadas de 0 a 512. */
function colorEn(x, y) {
  const dx = x - BASE / 2
  const dy = y - BASE / 2

  if (dx * dx + dy * dy <= RADIO_CENTRO * RADIO_CENTRO) return CENTRO

  for (let i = 0; i < PETALOS; i++) {
    const angulo = (i * 2 * Math.PI) / PETALOS
    const px = Math.cos(angulo) * DIST_PETALO
    const py = Math.sin(angulo) * DIST_PETALO
    const ex = dx - px
    const ey = dy - py
    if (ex * ex + ey * ey <= RADIO_PETALO * RADIO_PETALO) return PETALO
  }

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

// La versión vectorial, para las pestañas del navegador.
const petalos = Array.from({ length: PETALOS }, (_, i) => {
  const angulo = (i * 2 * Math.PI) / PETALOS
  const cx = (BASE / 2 + Math.cos(angulo) * DIST_PETALO).toFixed(1)
  const cy = (BASE / 2 + Math.sin(angulo) * DIST_PETALO).toFixed(1)
  return `  <circle cx="${cx}" cy="${cy}" r="${RADIO_PETALO}" fill="rgb(${PETALO})" />`
}).join("\n")

writeFileSync(
  join(PUBLIC, "icon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BASE} ${BASE}" width="${BASE}" height="${BASE}" role="img" aria-label="Gran Abasto Girasol">
  <rect width="${BASE}" height="${BASE}" fill="rgb(${FONDO})" />
${petalos}
  <circle cx="${BASE / 2}" cy="${BASE / 2}" r="${RADIO_CENTRO}" fill="rgb(${CENTRO})" />
</svg>
`,
)
console.log("icon.svg")
