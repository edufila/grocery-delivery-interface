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

  if (ancho <= LADO && alto <= LADO) {
    console.log(`  ${nombre.padEnd(24)} ya mide ${ancho}×${alto}, se deja`)
    despues += original.length
    continue
  }

  // `redimensionar` trabaja sobre un cuadrado, que es lo que son estas fotos.
  // Una que no lo sea se deja como está en vez de deformarla.
  if (ancho !== alto) {
    console.log(`  ${nombre.padEnd(24)} no es cuadrada (${ancho}×${alto}), se deja`)
    despues += original.length
    continue
  }

  const chica = redimensionar(pixels, ancho, alto, LADO)
  const nueva = png(LADO, chica)

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
      `  ->  ${LADO}×${LADO} ${kb(nueva.length)}   (-${ahorro}%)`,
  )

  if (hacerlo) writeFileSync(ruta, nueva)
}

console.log("")
console.log(`  total   ${kb(antes)}  ->  ${kb(despues)}`)
console.log("")

if (!hacerlo) console.log("Nada se tocó. Corre con --hacerlo para aplicarlo.\n")
