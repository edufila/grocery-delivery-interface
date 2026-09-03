/**
 * Mete una imagen hecha afuera (Canva y parecidos) como ícono de la app.
 *
 *   node scripts/importar-icono.mjs <archivo.png> [--verde-app] [--salida carpeta]
 *
 * Lo que exportan esas herramientas no sirve tal cual: viene con las esquinas
 * ya redondeadas sobre un margen blanco. iOS y Android le ponen SU recorte
 * encima, así que quedaría un doble borde con una uña blanca alrededor. El
 * script recorta ese margen, deja el fondo a sangre y centra el dibujo con
 * aire suficiente para que ningún lanzador le coma nada.
 *
 * --verde-app pasa el fondo al verde de la interfaz (#059669).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import { leerPng, png, redimensionar } from "./png.mjs"

const VERDE_APP = [5, 150, 105] // emerald-600, el de toda la interfaz

/** Cuánto del cuadrado ocupa el dibujo. El resto es aire contra el recorte. */
const OCUPACION = 0.86

/**
 * Recorte fijo mínimo, solo para no arrastrar el filo del borde. Las esquinas
 * redondeadas no se recortan: se rellenan, que no depende de adivinar el radio.
 */
const RECORTE = 0.01

const SALIDAS = [
  ["apple-icon.png", 180], // el que usa iOS en la pantalla de inicio
  ["icon-192.png", 192], // el mínimo que Android pide para ofrecer instalar
  ["icon-512.png", 512],
  ["icon-32.png", 32], // la pestaña del navegador
]

// ------------------------------------------------------------------ ayudas

const esBlanco = (r, g, b) => r > 238 && g > 238 && b > 238

/** El rectángulo que ocupa el dibujo, sin el margen blanco de alrededor. */
function recuadroUtil(pixels, ancho, alto) {
  let x0 = ancho
  let y0 = alto
  let x1 = -1
  let y1 = -1

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 4
      if (pixels[i + 3] < 8) continue
      if (esBlanco(pixels[i], pixels[i + 1], pixels[i + 2])) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }

  if (x1 < 0) throw new Error("La imagen está en blanco.")
  return { x0, y0, x1, y1 }
}

/** Recorta un cuadrado centrado, ya sin esquinas redondeadas ni margen. */
function recortarCuadrado(pixels, ancho, alto) {
  const { x0, y0, x1, y1 } = recuadroUtil(pixels, ancho, alto)
  const lado = Math.min(x1 - x0 + 1, y1 - y0 + 1)
  const quitar = Math.round(lado * RECORTE)
  const nuevo = lado - quitar * 2

  const cx = Math.round((x0 + x1) / 2)
  const cy = Math.round((y0 + y1) / 2)
  const desdeX = Math.max(0, cx - (nuevo >> 1))
  const desdeY = Math.max(0, cy - (nuevo >> 1))

  const salida = Buffer.alloc(nuevo * nuevo * 4)
  for (let y = 0; y < nuevo; y++) {
    const origen = ((desdeY + y) * ancho + desdeX) * 4
    pixels.copy(salida, y * nuevo * 4, origen, origen + nuevo * 4)
  }

  return { pixels: salida, lado: nuevo }
}

/**
 * El color de fondo. Se mira la franja del medio a izquierda y derecha, no el
 * borde entero: arriba y abajo están las esquinas redondeadas, que son blancas
 * y ganarían la votación.
 */
function colorDeFondo(pixels, lado) {
  const cuenta = new Map()
  const mirar = (x, y) => {
    const i = (y * lado + x) * 4
    if (esBlanco(pixels[i], pixels[i + 1], pixels[i + 2])) return
    const clave = `${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1)
  }

  for (let y = Math.round(lado * 0.35); y < lado * 0.65; y++) {
    for (let x = 0; x < 3; x++) {
      mirar(x, y)
      mirar(lado - 1 - x, y)
    }
  }

  const [mayoria] = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]
  return mayoria.split(",").map(Number)
}

const distancia = (pixels, i, color) =>
  Math.hypot(pixels[i] - color[0], pixels[i + 1] - color[1], pixels[i + 2] - color[2])

/**
 * Rellena con el fondo el margen claro de afuera, entrando desde las cuatro
 * esquinas. Así no hace falta saber qué radio tiene el redondeo: se pinta lo
 * que esté pegado al borde y sea más claro que el fondo, y se para al llegar
 * al dibujo. Después se ensancha unas pasadas para llevarse el halo del
 * suavizado, que si no queda como un filo blanco en la curva.
 */
function rellenarMargen(pixels, lado, fondo) {
  const pintado = new Uint8Array(lado * lado)
  const pila = []

  const sePuedePintar = (i) =>
    distancia(pixels, i, [255, 255, 255]) < distancia(pixels, i, fondo)

  for (const [x, y] of [
    [0, 0],
    [lado - 1, 0],
    [0, lado - 1],
    [lado - 1, lado - 1],
  ]) {
    pila.push(y * lado + x)
  }

  while (pila.length) {
    const p = pila.pop()
    if (pintado[p]) continue
    if (!sePuedePintar(p * 4)) continue

    pintado[p] = 1
    const x = p % lado
    const y = (p / lado) | 0
    if (x > 0) pila.push(p - 1)
    if (x < lado - 1) pila.push(p + 1)
    if (y > 0) pila.push(p - lado)
    if (y < lado - 1) pila.push(p + lado)
  }

  // El suavizado deja una orla que ya no es blanca pero tampoco es el fondo.
  for (let pasada = 0; pasada < 3; pasada++) {
    const suma = []
    for (let p = 0; p < pintado.length; p++) {
      if (pintado[p]) continue
      const x = p % lado
      const y = (p / lado) | 0
      const vecino =
        (x > 0 && pintado[p - 1]) ||
        (x < lado - 1 && pintado[p + 1]) ||
        (y > 0 && pintado[p - lado]) ||
        (y < lado - 1 && pintado[p + lado])
      if (vecino && distancia(pixels, p * 4, fondo) > 12) suma.push(p)
    }
    for (const p of suma) pintado[p] = 1
  }

  let cambiados = 0
  for (let p = 0; p < pintado.length; p++) {
    if (!pintado[p]) continue
    pixels[p * 4] = fondo[0]
    pixels[p * 4 + 1] = fondo[1]
    pixels[p * 4 + 2] = fondo[2]
    pixels[p * 4 + 3] = 255
    cambiados++
  }

  return cambiados
}

/**
 * Cambia el fondo por otro color, arrastrando también los píxeles del borde
 * suavizado: un umbral seco dejaría un halo del color viejo alrededor del
 * dibujo.
 */
function recolorearFondo(pixels, lado, desde, hasta) {
  const tolerancia = 90

  for (let i = 0; i < lado * lado * 4; i += 4) {
    const d = Math.hypot(
      pixels[i] - desde[0],
      pixels[i + 1] - desde[1],
      pixels[i + 2] - desde[2],
    )
    if (d > tolerancia) continue

    const t = 1 - d / tolerancia
    for (let c = 0; c < 3; c++) {
      pixels[i + c] = Math.round(pixels[i + c] + (hasta[c] - desde[c]) * t)
    }
  }
}

/** El dibujo centrado sobre un cuadrado del color de fondo, a sangre. */
function componer(contenido, lado, size, fondo) {
  const lienzo = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    lienzo[i * 4] = fondo[0]
    lienzo[i * 4 + 1] = fondo[1]
    lienzo[i * 4 + 2] = fondo[2]
    lienzo[i * 4 + 3] = 255
  }

  const interior = Math.round(size * OCUPACION)
  const chico = redimensionar(contenido, lado, lado, interior)
  const margen = Math.round((size - interior) / 2)

  for (let y = 0; y < interior; y++) {
    const origen = y * interior * 4
    const destino = ((margen + y) * size + margen) * 4
    chico.copy(lienzo, destino, origen, origen + interior * 4)
  }

  // Nada queda translúcido: con alfa, iOS pinta el hueco de negro.
  for (let i = 3; i < lienzo.length; i += 4) lienzo[i] = 255
  return lienzo
}

// ---------------------------------------------------------------- programa

const args = process.argv.slice(2)
const archivo = args.find((a) => !a.startsWith("--"))
if (!archivo) {
  console.error("Uso: node scripts/importar-icono.mjs <archivo.png> [--verde-app] [--salida carpeta]")
  process.exit(1)
}

const iSalida = args.indexOf("--salida")
const carpeta =
  iSalida >= 0
    ? args[iSalida + 1]
    : join(dirname(fileURLToPath(import.meta.url)), "..", "public")
mkdirSync(carpeta, { recursive: true })

const origen = leerPng(readFileSync(archivo))
console.log(`entra: ${origen.ancho}x${origen.alto}`)

const { pixels, lado } = recortarCuadrado(origen.pixels, origen.ancho, origen.alto)
const fondoOriginal = colorDeFondo(pixels, lado)
console.log(`recortado a ${lado}x${lado}, fondo rgb(${fondoOriginal})`)

const rellenados = rellenarMargen(pixels, lado, fondoOriginal)
console.log(
  `margen y esquinas rellenados: ${rellenados} px (${((rellenados / (lado * lado)) * 100).toFixed(1)}%)`,
)

/**
 * --verde-app da por sentado que el fondo es un color plano. Si la ilustración
 * trae dos tonos (una sombra larga en diagonal, por ejemplo) recolorearía uno
 * solo y quedaría un parche. Mejor avisar que arruinar el ícono callado.
 */
function fondoDesparejo(pixels, lado) {
  const punta = (x, y) => {
    const i = (y * lado + x) * 4
    return [pixels[i], pixels[i + 1], pixels[i + 2]]
  }
  const bordes = [
    punta(2, lado >> 1),
    punta(lado - 3, lado >> 1),
    punta(lado >> 1, 2),
    punta(lado >> 1, lado - 3),
  ]

  return bordes.some((c) =>
    bordes.some((d) => Math.hypot(c[0] - d[0], c[1] - d[1], c[2] - d[2]) > 25),
  )
}

let fondo = fondoOriginal
if (args.includes("--verde-app") && fondoDesparejo(pixels, lado)) {
  console.error(
    "El fondo tiene más de un tono (¿una sombra en diagonal?). --verde-app\n" +
      "recolorearía solo uno y quedaría un parche: se deja el color original.",
  )
} else if (args.includes("--verde-app")) {
  recolorearFondo(pixels, lado, fondoOriginal, VERDE_APP)
  fondo = VERDE_APP
  console.log(`fondo pasado al verde de la app rgb(${VERDE_APP})`)
}

for (const [nombre, size] of SALIDAS) {
  writeFileSync(join(carpeta, nombre), png(size, componer(pixels, lado, size, fondo)))
  console.log(`${nombre} (${size}px)`)
}
