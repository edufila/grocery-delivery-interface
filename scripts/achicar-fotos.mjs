#!/usr/bin/env node
/**
 * Achica las fotos de `public/images` al tamaño con el que de verdad se ven.
 *
 *   node scripts/achicar-fotos.mjs             dice qué haría, sin tocar nada
 *   node scripts/achicar-fotos.mjs --hacerlo   lo hace
 *
 * POR QUÉ EXISTE. Las dos fotos de los abastos venían de 1024×1024 y 2,6 MB
 * cada una, y se muestran en una tarjeta de 144 píxeles de alto. Eran 5,3 MB en
 * la primera pantalla que carga cualquiera, con datos móviles, para mostrar algo
 * siete veces más chico. Es el peor sitio posible para desperdiciar peso.
 *
 * Lo natural sería que `next/image` las sirviera redimensionadas, y se intentó:
 * el endpoint funciona -- deja la de 2,6 MB en 255 KB -- pero el componente
 * dibuja en blanco, también en un build de producción. Casi seguro porque falta
 * `sharp` y en este proyecto `npm install` está roto. Así que se achica el
 * archivo, que no depende de nada instalado.
 *
 * NO TOCA LAS QUE SUBE EL PANEL: el recortador ya guarda en WebP al 85% y en el
 * tamaño correcto. Esto es para las que vinieron con la plantilla.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { leerPng, redimensionar, png } from "./png.mjs"

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const CARPETA = join(REPO, "public", "images")

/**
 * El ancho máximo al que se ve una foto de abasto: la tarjeta tiene 448 px de
 * tope y en una pantalla de las que duplican pixeles eso son 896. Se deja en
 * 640 -- entre los dos -- porque el salto de calidad de 640 a 896 no se nota en
 * una foto de fondo y el de peso sí.
 */
const LADO = 640

/**
 * Las fotos de los abastos se recortan a la forma con la que se ven.
 *
 * La tarjeta las muestra en una franja de 448 por 144, o sea algo más de tres a
 * uno, y el navegador recorta el resto con `object-cover`. Guardarlas cuadradas
 * significaba mandar al teléfono tres veces más imagen de la que se ve, para
 * que la tirara. Recortando la misma franja que recorta el CSS, el resultado en
 * pantalla es idéntico y pesa la tercera parte.
 *
 * Se recorta del centro, que es justo lo que hace `object-cover`.
 */
const PROPORCION_TARJETA = 448 / 144
const ANCHO_TARJETA = 640

function recortarFranja(origen, anchoOrigen, altoOrigen, anchoDestino, altoDestino) {
  const salida = Buffer.alloc(anchoDestino * altoDestino * 4)

  // La franja del original que corresponde: todo el ancho, y del alto lo que
  // entre en la proporción, centrado.
  const altoFranja = Math.min(altoOrigen, Math.round(anchoOrigen / PROPORCION_TARJETA))
  const desde = Math.round((altoOrigen - altoFranja) / 2)

  const escalaX = anchoOrigen / anchoDestino
  const escalaY = altoFranja / altoDestino

  for (let y = 0; y < altoDestino; y++) {
    const y0 = desde + Math.floor(y * escalaY)
    const y1 = Math.max(y0 + 1, desde + Math.floor((y + 1) * escalaY))

    for (let x = 0; x < anchoDestino; x++) {
      const x0 = Math.floor(x * escalaX)
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * escalaX))

      let r = 0, g = 0, b = 0, a = 0, n = 0
      for (let sy = y0; sy < y1 && sy < altoOrigen; sy++) {
        for (let sx = x0; sx < x1 && sx < anchoOrigen; sx++) {
          const i = (sy * anchoOrigen + sx) * 4
          r += origen[i]; g += origen[i + 1]; b += origen[i + 2]; a += origen[i + 3]; n++
        }
      }

      const d = (y * anchoDestino + x) * 4
      salida[d] = Math.round(r / n)
      salida[d + 1] = Math.round(g / n)
      salida[d + 2] = Math.round(b / n)
      salida[d + 3] = Math.round(a / n)
    }
  }

  return salida
}

const hacerlo = process.argv.includes("--hacerlo")

const kb = (n) => `${Math.round(n / 1024)} KB`

let archivos
try {
  archivos = readdirSync(CARPETA).filter((f) => f.toLowerCase().endsWith(".png"))
} catch {
  console.log(`\nNo hay carpeta ${CARPETA}. Nada que hacer.\n`)
  process.exit(0)
}

if (archivos.length === 0) {
  console.log("\nNo hay PNG en public/images. Nada que hacer.\n")
  process.exit(0)
}

console.log(hacerlo ? "\nAchicando\n" : "\nEsto es lo que haría (--hacerlo para hacerlo)\n")

let antes = 0
let despues = 0

for (const nombre of archivos) {
  const ruta = join(CARPETA, nombre)
  const original = readFileSync(ruta)
  antes += original.length

  let imagen
  try {
    imagen = leerPng(original)
  } catch (error) {
    console.log(`  ${nombre.padEnd(24)} no se pudo leer: ${error.message}`)
    despues += original.length
    continue
  }

  const { ancho, alto, pixels } = imagen

  // Una de tienda ya recortada tiene la proporción de la tarjeta: se deja.
  if (Math.abs(ancho / alto - PROPORCION_TARJETA) < 0.05) {
    console.log(`  ${nombre.padEnd(24)} ya recortada a ${ancho}×${alto}, se deja`)
    despues += original.length
    continue
  }

  if (!nombre.startsWith("store-") && ancho <= LADO && alto <= LADO) {
    console.log(`  ${nombre.padEnd(24)} ya mide ${ancho}×${alto}, se deja`)
    despues += original.length
    continue
  }

  const esDeTienda = nombre.startsWith("store-")

  // `redimensionar` trabaja sobre un cuadrado. Una foto que no lo sea y que no
  // sea de tienda se deja como está en vez de deformarla.
  if (!esDeTienda && ancho !== alto) {
    console.log(`  ${nombre.padEnd(24)} no es cuadrada (${ancho}×${alto}), se deja`)
    despues += original.length
    continue
  }

  const anchoFinal = esDeTienda ? ANCHO_TARJETA : LADO
  const altoFinal = esDeTienda ? Math.round(ANCHO_TARJETA / PROPORCION_TARJETA) : LADO
  const chica = esDeTienda
    ? recortarFranja(pixels, ancho, alto, anchoFinal, altoFinal)
    : redimensionar(pixels, ancho, alto, LADO)
  const nueva = png(anchoFinal, chica, altoFinal)

  // Si por lo que sea no adelgaza, se deja la de antes: el objetivo es pesar
  // menos, no reescribir archivos.
  if (nueva.length >= original.length) {
    console.log(`  ${nombre.padEnd(24)} no adelgaza, se deja`)
    despues += original.length
    continue
  }

  despues += nueva.length
  const ahorro = Math.round((1 - nueva.length / original.length) * 100)
  console.log(
    `  ${nombre.padEnd(24)} ${ancho}×${alto} ${kb(original.length)}` +
      `  ->  ${anchoFinal}×${altoFinal} ${kb(nueva.length)}   (-${ahorro}%)`,
  )

  if (hacerlo) writeFileSync(ruta, nueva)
}

console.log("")
console.log(`  total   ${kb(antes)}  ->  ${kb(despues)}`)
console.log("")

if (!hacerlo) console.log("Nada se tocó. Corre con --hacerlo para aplicarlo.\n")
