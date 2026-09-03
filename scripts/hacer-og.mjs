/**
 * Arma la imagen de vista previa para cuando se comparte el link (WhatsApp,
 * Telegram, Facebook).
 *
 *   node scripts/hacer-og.mjs
 *
 * Va cuadrada a propósito. WhatsApp decide solo cómo mostrar la tarjeta: con
 * una imagen apaisada pone el banner grande, con una cuadrada deja la
 * miniatura chiquita al lado del texto, que es la que queremos.
 *
 * Grande igual: 600 píxeles para una miniatura de cien y pico puede parecer
 * de más, pero es lo que la hace verse nítida en pantallas de alta densidad,
 * que es donde antes se veía borrosa.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import { leerPng, png, redimensionar } from "./png.mjs"

const LADO = 600

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..")
const origen = leerPng(readFileSync(join(raiz, "assets", "icono-origen.png")))

// La ilustración ya es cuadrada: alcanza con bajarla de tamaño, sin recortes
// ni rellenos, así que no hay ninguna costura posible.
const pixels = redimensionar(origen.pixels, origen.ancho, origen.alto, LADO)
for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255

writeFileSync(join(raiz, "public", "og.png"), png(LADO, pixels))
console.log(`og.png (${LADO}x${LADO})`)
