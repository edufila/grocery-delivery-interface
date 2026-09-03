/**
 * Dibuja y codifica PNG con los módulos de Node, sin dependencias: instalar un
 * rasterizador fallaba en esta máquina y los íconos son formas simples.
 *
 * Lo usan `make-icons.mjs` (los íconos de la app) y `muestras-icono.mjs`
 * (las variantes para elegir).
 */
import { deflateSync, inflateSync } from "node:zlib"

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

// ------------------------------------------------------------- decodificar

const CANALES = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }

/** Deshace el filtro por fila que aplica el formato antes de comprimir. */
function desfiltrar(datos, ancho, alto, bytesPorPixel) {
  const bytesPorFila = ancho * bytesPorPixel
  const salida = Buffer.alloc(alto * bytesPorFila)

  for (let y = 0; y < alto; y++) {
    const filtro = datos[y * (bytesPorFila + 1)]
    const entra = y * (bytesPorFila + 1) + 1
    const sale = y * bytesPorFila

    for (let i = 0; i < bytesPorFila; i++) {
      const crudo = datos[entra + i]
      const izq = i >= bytesPorPixel ? salida[sale + i - bytesPorPixel] : 0
      const arriba = y > 0 ? salida[sale - bytesPorFila + i] : 0
      const diagonal =
        y > 0 && i >= bytesPorPixel ? salida[sale - bytesPorFila + i - bytesPorPixel] : 0

      let valor
      switch (filtro) {
        case 0:
          valor = crudo
          break
        case 1:
          valor = crudo + izq
          break
        case 2:
          valor = crudo + arriba
          break
        case 3:
          valor = crudo + ((izq + arriba) >> 1)
          break
        case 4: {
          // Paeth: se queda con el vecino que mejor predice el valor.
          const p = izq + arriba - diagonal
          const pa = Math.abs(p - izq)
          const pb = Math.abs(p - arriba)
          const pc = Math.abs(p - diagonal)
          valor = crudo + (pa <= pb && pa <= pc ? izq : pb <= pc ? arriba : diagonal)
          break
        }
        default:
          throw new Error(`Filtro PNG desconocido: ${filtro}`)
      }

      salida[sale + i] = valor & 0xff
    }
  }

  return salida
}

/**
 * Lee un PNG de 8 bits por canal y lo devuelve como RGBA plano.
 * Alcanza para lo que exporta Canva; no cubre entrelazado ni 16 bits.
 */
export function leerPng(buffer) {
  let pos = 8 // firma
  let ihdr = null
  const idat = []
  let paleta = null
  let transparencia = null

  while (pos < buffer.length) {
    const largo = buffer.readUInt32BE(pos)
    const tipo = buffer.toString("ascii", pos + 4, pos + 8)
    const datos = buffer.subarray(pos + 8, pos + 8 + largo)

    if (tipo === "IHDR") {
      ihdr = {
        ancho: datos.readUInt32BE(0),
        alto: datos.readUInt32BE(4),
        bits: datos[8],
        color: datos[9],
        entrelazado: datos[12],
      }
    } else if (tipo === "PLTE") paleta = Buffer.from(datos)
    else if (tipo === "tRNS") transparencia = Buffer.from(datos)
    else if (tipo === "IDAT") idat.push(Buffer.from(datos))
    else if (tipo === "IEND") break

    pos += 12 + largo
  }

  if (!ihdr) throw new Error("PNG sin cabecera")
  if (ihdr.bits !== 8) throw new Error(`Solo 8 bits por canal, vino ${ihdr.bits}`)
  if (ihdr.entrelazado) throw new Error("PNG entrelazado: no soportado")

  const canales = CANALES[ihdr.color]
  if (!canales) throw new Error(`Tipo de color ${ihdr.color} no soportado`)

  const crudo = desfiltrar(
    inflateSync(Buffer.concat(idat)),
    ihdr.ancho,
    ihdr.alto,
    canales,
  )

  const pixels = Buffer.alloc(ihdr.ancho * ihdr.alto * 4)
  for (let i = 0; i < ihdr.ancho * ihdr.alto; i++) {
    const e = i * canales
    const s = i * 4
    let r
    let g
    let b
    let a = 255

    if (ihdr.color === 3) {
      const idx = crudo[e]
      r = paleta[idx * 3]
      g = paleta[idx * 3 + 1]
      b = paleta[idx * 3 + 2]
      if (transparencia && idx < transparencia.length) a = transparencia[idx]
    } else if (ihdr.color === 0) {
      r = g = b = crudo[e]
    } else if (ihdr.color === 4) {
      r = g = b = crudo[e]
      a = crudo[e + 1]
    } else if (ihdr.color === 2) {
      r = crudo[e]
      g = crudo[e + 1]
      b = crudo[e + 2]
    } else {
      r = crudo[e]
      g = crudo[e + 1]
      b = crudo[e + 2]
      a = crudo[e + 3]
    }

    pixels[s] = r
    pixels[s + 1] = g
    pixels[s + 2] = b
    pixels[s + 3] = a
  }

  return { ancho: ihdr.ancho, alto: ihdr.alto, pixels }
}

/**
 * Reduce una imagen promediando el bloque de origen de cada píxel. Es lo que
 * mantiene legible un ícono al bajarlo a 32 píxeles; tomar una muestra suelta
 * lo deja dentado.
 */
export function redimensionar(origen, anchoOrigen, altoOrigen, destino) {
  const salida = Buffer.alloc(destino * destino * 4)
  const escalaX = anchoOrigen / destino
  const escalaY = altoOrigen / destino

  for (let y = 0; y < destino; y++) {
    const y0 = Math.floor(y * escalaY)
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * escalaY))

    for (let x = 0; x < destino; x++) {
      const x0 = Math.floor(x * escalaX)
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * escalaX))

      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0

      for (let sy = y0; sy < y1 && sy < altoOrigen; sy++) {
        for (let sx = x0; sx < x1 && sx < anchoOrigen; sx++) {
          const i = (sy * anchoOrigen + sx) * 4
          r += origen[i]
          g += origen[i + 1]
          b += origen[i + 2]
          a += origen[i + 3]
          n++
        }
      }

      const s = (y * destino + x) * 4
      salida[s] = Math.round(r / n)
      salida[s + 1] = Math.round(g / n)
      salida[s + 2] = Math.round(b / n)
      salida[s + 3] = Math.round(a / n)
    }
  }

  return salida
}

/**
 * Codifica RGBA como PNG. `alto` por defecto es igual al ancho: los íconos son
 * cuadrados, la imagen para compartir el link no.
 *
 * Si ningún píxel es translúcido -- que es siempre nuestro caso, porque un
 * ícono con transparencia lo pinta de negro iOS -- se guarda sin el canal alfa.
 * Es una cuarta parte menos de datos, y en la imagen de vista previa eso
 * decide si WhatsApp la muestra o la descarta por pesada.
 */
export function png(ancho, pixels, alto = ancho) {
  let opaca = true
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] !== 255) {
      opaca = false
      break
    }
  }

  const canales = opaca ? 3 : 4
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(ancho, 0)
  ihdr.writeUInt32BE(alto, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = opaca ? 2 : 6 // RGB o RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  // Cada fila lleva adelante su byte de filtro; 0 es "sin filtrar".
  const bytesPorFila = ancho * canales
  const filas = Buffer.alloc(alto * (bytesPorFila + 1))
  for (let y = 0; y < alto; y++) {
    filas[y * (bytesPorFila + 1)] = 0
    for (let x = 0; x < ancho; x++) {
      const entra = (y * ancho + x) * 4
      const sale = y * (bytesPorFila + 1) + 1 + x * canales
      filas[sale] = pixels[entra]
      filas[sale + 1] = pixels[entra + 1]
      filas[sale + 2] = pixels[entra + 2]
      if (!opaca) filas[sale + 3] = pixels[entra + 3]
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(filas, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
}
