/**
 * Dibuja y codifica PNG con los módulos de Node, sin dependencias: instalar un
 * rasterizador fallaba en esta máquina y los íconos son formas simples.
 *
 * Lo usan `make-icons.mjs` (los íconos de la app) y `muestras-icono.mjs`
 * (las variantes para elegir).
 */
import { deflateSync } from "node:zlib"

/** Lienzo de referencia: todos los dibujos se miden sobre 512 y se escalan. */
export const BASE = 512

// ------------------------------------------------------------- primitivas

export function enCirculo(x, y, cx, cy, r) {
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= r * r
}

export function enElipse(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx
  const dy = (y - cy) / ry
  return dx * dx + dy * dy <= 1
}

/** Anillo: sirve para trazos circulares y contornos. */
export function enAnillo(x, y, cx, cy, r, grosor) {
  const d = Math.hypot(x - cx, y - cy)
  return d >= r - grosor / 2 && d <= r + grosor / 2
}

/** Rectángulo de esquinas redondeadas. */
export function enRectRedondo(x, y, x0, y0, x1, y1, r) {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r)
  const cy = Math.min(Math.max(y, y0 + r), y1 - r)
  return enCirculo(x, y, cx, cy, r)
}

/** Segmento grueso de punta redonda: trazos, mimbre, tallos, asas. */
export function enCapsula(x, y, x0, y0, x1, y1, r) {
  const vx = x1 - x0
  const vy = y1 - y0
  const largo = vx * vx + vy * vy
  const t = largo === 0 ? 0 : Math.min(1, Math.max(0, ((x - x0) * vx + (y - y0) * vy) / largo))
  return enCirculo(x, y, x0 + vx * t, y0 + vy * t, r)
}

/** Polígono convexo, con los puntos en sentido horario. */
export function enPoligono(x, y, puntos) {
  for (let i = 0; i < puntos.length; i++) {
    const [ax, ay] = puntos[i]
    const [bx, by] = puntos[(i + 1) % puntos.length]
    if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < 0) return false
  }
  return true
}

// --------------------------------------------------------------- rasterizar

/**
 * Píxeles RGBA de un dibujo, con 4x4 muestras por píxel para que los bordes
 * curvos no queden dentados.
 *
 * `colorEn(x, y)` recibe coordenadas sobre el lienzo de 512 y devuelve [r,g,b].
 */
export function pintar(size, colorEn) {
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

export function png(size, pixels) {
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
