/**
 * Arma la imagen de vista previa para cuando se comparte el link (WhatsApp,
 * Telegram, Facebook, X).
 *
 *   node scripts/hacer-og.mjs
 *
 * Sin esto, WhatsApp agarra el ícono de 180 píxeles y lo estira: por eso se
 * veía borroso. Estas plataformas quieren 1200x630, apaisada.
 *
 * El truco para pasar de una ilustración cuadrada a una apaisada sin que se
 * note el pegote es estirar los bordes: cada franja de los costados se rellena
 * con el color del píxel del borde de ESA fila. Así el color continúa exacto y
 * no queda ninguna línea donde se vea la unión, aunque el fondo tenga sombras.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import { leerPng, png, redimensionar } from "./png.mjs"

const ANCHO = 1200
const ALTO = 630

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..")
const origen = leerPng(readFileSync(join(raiz, "assets", "icono-origen.png")))

// El dibujo entra a lo alto y queda centrado; los costados se rellenan.
const lado = ALTO
const chico = redimensionar(origen.pixels, origen.ancho, origen.alto, lado)
const desde = Math.round((ANCHO - lado) / 2)

const lienzo = Buffer.alloc(ANCHO * ALTO * 4)

for (let y = 0; y < ALTO; y++) {
  const fila = y * lado * 4
  const finFila = fila + (lado - 1) * 4

  for (let x = 0; x < ANCHO; x++) {
    const i = (y * ANCHO + x) * 4
    // Dentro del dibujo se copia; fuera se repite el píxel del borde de la fila.
    const j =
      x < desde ? fila : x >= desde + lado ? finFila : fila + (x - desde) * 4

    lienzo[i] = chico[j]
    lienzo[i + 1] = chico[j + 1]
    lienzo[i + 2] = chico[j + 2]
    lienzo[i + 3] = 255
  }
}

writeFileSync(join(raiz, "public", "og.png"), png(ANCHO, lienzo, ALTO))
console.log(`og.png (${ANCHO}x${ALTO})`)
