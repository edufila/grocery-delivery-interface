/**
 * Variantes del ícono para elegir. No entran al repo: se escriben donde le
 * digas por argumento y se miran de a montón.
 *
 *   node scripts/muestras-icono.mjs C:\ruta\donde\quiero\las\muestras
 *
 * La que gane se copia a `make-icons.mjs`, que es el que genera los íconos
 * de verdad en public/.
 */
import { writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

import {
  BASE,
  enAnillo,
  enCapsula,
  enCirculo,
  enElipse,
  enPoligono,
  enRectRedondo,
  pintar,
  png,
} from "./png.mjs"

const VERDE = [5, 150, 105] // emerald-600
const VERDE_HONDO = [4, 120, 87] // emerald-700
const BLANCO = [255, 255, 255]
const CREMA = [255, 251, 235] // amber-50
const MIMBRE = [194, 132, 63]
const MIMBRE_HONDO = [139, 90, 43]
const PAPEL = [214, 161, 94]
const PAPEL_CLARO = [231, 190, 137]
const NARANJA = [249, 115, 22]
const ROJO = [239, 68, 68]
const AMARILLO = [251, 191, 36]
const HOJA = [22, 163, 74] // green-600
const HOJA_CLARA = [74, 222, 128] // green-400
const MORADO = [139, 92, 246] // violet-500

const C = BASE / 2

/** Las tres frutas que asoman, para no repetirlas en cada variante. */
function frutas(x, y, subir = 0) {
  const yy = y + subir
  if (enCirculo(x, yy, 198, 234, 46)) return NARANJA
  if (enCirculo(x, yy, 264, 210, 43)) return ROJO
  if (enCirculo(x, yy, 322, 238, 44)) return AMARILLO
  return null
}

// ---------------------------------------------------------------- variantes

/** 1. Mimbre: cesta tejida, la más "de abasto". */
function mimbre(x, yBruto) {
  const y = yBruto + 24

  // Borde superior.
  if (enRectRedondo(x, y, 112, 264, 400, 312, 24)) return MIMBRE_HONDO

  if (y > 308 && enElipse(x, y, 256, 296, 122, 112)) {
    // Tejido: diagonales cruzadas.
    for (let i = -4; i <= 4; i++) {
      const d = i * 46
      if (enCapsula(x, y, 130 + d, 300, 250 + d, 420, 7)) return MIMBRE_HONDO
      if (enCapsula(x, y, 250 + d, 300, 130 + d, 420, 7)) return MIMBRE_HONDO
    }
    return MIMBRE
  }

  return frutas(x, yBruto, 24) ?? VERDE
}

/** 2. Bolsa de papel: lo que llega a la puerta. */
function bolsa(x, yBruto) {
  const y = yBruto + 14

  // Verduras asomando por la boca de la bolsa.
  if (y < 300) {
    if (enCapsula(x, y, 300, 250, 336, 150, 20)) return HOJA
    if (enCapsula(x, y, 300, 250, 268, 168, 16)) return HOJA_CLARA
    if (enCirculo(x, y, 206, 226, 44)) return NARANJA
    if (enCirculo(x, y, 262, 206, 40)) return ROJO
  }

  // Cuerpo y solapa.
  if (enRectRedondo(x, y, 138, 268, 374, 424, 18)) {
    if (y < 314) return PAPEL_CLARO
    return PAPEL
  }

  return VERDE
}

/** 3. Trazo: solo contornos blancos. La más limpia. */
function trazo(x, yBruto) {
  const y = yBruto + 22

  // Frutas como aros.
  if (enAnillo(x, y, 206, 232, 42, 16)) return BLANCO
  if (enAnillo(x, y, 306, 236, 40, 16)) return BLANCO

  // Borde de la cesta.
  if (enCapsula(x, y, 128, 292, 384, 292, 17)) return BLANCO

  // Cuerpo: media elipse en trazo.
  if (y > 300) {
    const d = Math.hypot((x - 256) / 116, (y - 296) / 116)
    if (d >= 0.86 && d <= 1) return BLANCO
    for (const cx of [200, 256, 312]) {
      if (enCapsula(x, y, cx, 322, cx, 372, 8)) return BLANCO
    }
  }

  return VERDE
}

/** 4. Insignia: círculo blanco con la cesta en verde adentro. */
function insignia(x, y) {
  if (!enCirculo(x, y, C, C, 196)) return VERDE

  const yy = y + 20
  if (enRectRedondo(x, yy, 158, 276, 354, 314, 19)) return VERDE_HONDO
  if (yy > 310 && enElipse(x, yy, 256, 300, 84, 78)) {
    for (const cx of [222, 256, 290]) {
      if (enRectRedondo(x, yy, cx - 6, 324, cx + 6, 364, 6)) return BLANCO
    }
    return VERDE_HONDO
  }
  if (enCirculo(x, yy, 216, 250, 32)) return NARANJA
  if (enCirculo(x, yy, 264, 234, 30)) return ROJO
  if (enCirculo(x, yy, 306, 252, 30)) return AMARILLO

  return BLANCO
}

/** 5. Verduras: zanahoria y hojas, no solo bolitas. */
function verduras(x, yBruto) {
  const y = yBruto + 26

  if (enRectRedondo(x, y, 116, 268, 396, 314, 23)) return CREMA

  if (y > 310 && enElipse(x, y, 256, 300, 120, 108)) {
    for (const cx of [196, 256, 316]) {
      if (enRectRedondo(x, y, cx - 9, 330, cx + 9, 390, 9)) return VERDE
    }
    return CREMA
  }

  // Zanahoria con su penacho.
  if (enPoligono(x, y, [[292, 168], [326, 254], [258, 254]])) return NARANJA
  if (enCapsula(x, y, 292, 176, 268, 128, 13)) return HOJA
  if (enCapsula(x, y, 292, 176, 320, 132, 13)) return HOJA_CLARA

  // Hoja grande a la izquierda.
  if (enElipse(x, y, 186, 214, 54, 34)) return HOJA
  if (enCirculo(x, y, 236, 244, 30)) return ROJO

  return VERDE
}

/** 6. Bolsa con asas: la de tela, más de marca. */
function tote(x, yBruto) {
  const y = yBruto + 10

  // Asas.
  if (y < 300 && enAnillo(x, y, 256, 274, 84, 20) && y < 274) return CREMA

  if (enPoligono(x, y, [[148, 274], [364, 274], [388, 430], [124, 430]])) {
    if (enCirculo(x, y, 214, 344, 30)) return NARANJA
    if (enCirculo(x, y, 288, 336, 26)) return ROJO
    if (enCirculo(x, y, 252, 392, 24)) return MORADO
    return CREMA
  }

  return VERDE
}

// ------------------------------------------------------------------ generar

const salida = process.argv[2]
if (!salida) {
  console.error("Falta la carpeta de salida.")
  process.exit(1)
}
mkdirSync(salida, { recursive: true })

const variantes = [
  ["1-mimbre", mimbre],
  ["2-bolsa-papel", bolsa],
  ["3-trazo", trazo],
  ["4-insignia", insignia],
  ["5-verduras", verduras],
  ["6-tote", tote],
]

for (const [nombre, dibujo] of variantes) {
  // 192 es el tamaño real en la pantalla de inicio de un teléfono.
  writeFileSync(join(salida, `${nombre}.png`), png(192, pintar(192, dibujo)))
  console.log(nombre)
}
