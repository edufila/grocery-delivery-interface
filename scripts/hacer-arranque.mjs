#!/usr/bin/env node
/**
 * Las pantallas de arranque de iPhone.
 *
 *   node scripts/hacer-arranque.mjs
 *
 * POR QUÉ HACEN FALTA. Al abrir la app instalada, Android usa el icono y el
 * color del manifiesto y arma la pantalla de arranque solo. iOS no: si no
 * encuentra una imagen hecha a la medida exacta de esa pantalla, muestra
 * blanco. Y como el arranque en frío tarda un segundo largo con datos móviles,
 * ese blanco se ve, y un blanco sin nada no se distingue de una app rota.
 *
 * QUÉ HACE. Toma `public/icon-512.png` -- el icono tal cual, sin recortarlo ni
 * recolorearlo -- lo achica y lo centra sobre el color de fondo de la app. El
 * icono original no se toca: estas son imágenes aparte.
 *
 * LOS TAMAÑOS SON EXACTOS a propósito. iOS elige por media query según el
 * ancho, el alto y la densidad del equipo; si ninguna calza, no usa la más
 * parecida: usa blanco. Por eso hay una por modelo en vez de una escalable.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { leerPng, redimensionar, png } from "./png.mjs"

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const CARPETA = join(REPO, "public", "arranque")

/** El mismo gris cálido de fondo que el resto de la app (`--color-gray-50`). */
const FONDO = [246, 244, 241]

/**
 * Ancho y alto en píxeles reales, y la densidad del equipo.
 *
 * Cubre del iPhone 8 en adelante, que es de donde en adelante hay push web
 * (iOS 16.4). Un modelo que no esté aquí arranca en blanco como hasta ahora,
 * sin romperse.
 */
const PANTALLAS = [
  { w: 750, h: 1334, escala: 2, modelo: "SE, 8" },
  { w: 828, h: 1792, escala: 2, modelo: "XR, 11" },
  { w: 1125, h: 2436, escala: 3, modelo: "X, XS, 11 Pro" },
  { w: 1170, h: 2532, escala: 3, modelo: "12, 13, 14" },
  { w: 1179, h: 2556, escala: 3, modelo: "14 Pro, 15, 16" },
  { w: 1242, h: 2688, escala: 3, modelo: "XS Max, 11 Pro Max" },
  { w: 1284, h: 2778, escala: 3, modelo: "12/13/14 Plus" },
  { w: 1290, h: 2796, escala: 3, modelo: "14 Pro Max, 15/16 Pro Max" },
]

const icono = leerPng(readFileSync(join(REPO, "public", "icon-512.png")))

/** Pone el icono, ya achicado, centrado sobre un lienzo del color de fondo. */
function componer(ancho, alto, lado) {
  const lienzo = Buffer.alloc(ancho * alto * 4)
  for (let i = 0; i < ancho * alto; i++) {
    lienzo[i * 4] = FONDO[0]
    lienzo[i * 4 + 1] = FONDO[1]
    lienzo[i * 4 + 2] = FONDO[2]
    lienzo[i * 4 + 3] = 255
  }

  const chico = redimensionar(icono.pixels, icono.ancho, icono.alto, lado)
  const x0 = Math.round((ancho - lado) / 2)
  // Un pelo por encima del centro: centrado exacto se ve caído, porque el ojo
  // lee el centro óptico más arriba que el geométrico.
  const y0 = Math.round((alto - lado) / 2 - alto * 0.04)

  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const o = (y * lado + x) * 4
      const alfa = chico[o + 3] / 255
      if (alfa === 0) continue

      const d = ((y0 + y) * ancho + (x0 + x)) * 4
      // Se mezcla con el fondo por si el icono trae bordes semitransparentes.
      for (let c = 0; c < 3; c++) {
        lienzo[d + c] = Math.round(chico[o + c] * alfa + lienzo[d + c] * (1 - alfa))
      }
      lienzo[d + 3] = 255
    }
  }

  return png(ancho, lienzo, alto)
}

mkdirSync(CARPETA, { recursive: true })

console.log("\nPantallas de arranque para iPhone\n")

let total = 0
const enlaces = []

for (const { w, h, escala, modelo } of PANTALLAS) {
  // Un tercio del ancho: es el tamaño con el que un logo se lee sin gritar.
  const lado = Math.round(w / 3)
  const archivo = `arranque-${w}x${h}.png`
  const datos = componer(w, h, lado)
  writeFileSync(join(CARPETA, archivo), datos)
  total += datos.length

  console.log(
    `  ${archivo.padEnd(26)} ${String(Math.round(datos.length / 1024)).padStart(4)} KB   ${modelo}`,
  )

  // iOS elige por estas media queries, que van en puntos y no en píxeles.
  const puntos = { w: w / escala, h: h / escala }
  enlaces.push(
    `<link rel="apple-touch-startup-image" href="/arranque/${archivo}" ` +
      `media="(device-width: ${puntos.w}px) and (device-height: ${puntos.h}px) ` +
      `and (-webkit-device-pixel-ratio: ${escala}) and (orientation: portrait)" />`,
  )
}

console.log(`\n  ${PANTALLAS.length} imágenes, ${Math.round(total / 1024)} KB en total\n`)
console.log("Las etiquetas para el <head> (ya están puestas en app/layout.tsx):\n")
console.log(enlaces.join("\n"))
console.log("")
