#!/usr/bin/env node
/**
 * Genera una copia WebP de cada PNG de public/images y public/products.
 *
 *   node scripts/a-webp.mjs
 *
 * POR QUÉ. Las fotos se guardaban en PNG, que para una foto es el peor
 * formato: la de un abasto pesaba 367 KB y en WebP al 80% pesa 40 KB, con el
 * mismo tamaño en pantalla. Es la foto más grande del inicio.
 *
 * Los PNG se quedan: la vista previa de WhatsApp no siempre muestra WebP, y
 * la tarjeta que se comparte los sigue usando. Las pantallas piden el WebP.
 *
 * `sharp` está instalado pero no a la vista de Next (por eso `next/image` no
 * funciona, ver CLAUDE.md). Aquí se busca directo en la carpeta de pnpm.
 */
import { readdirSync, statSync, existsSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function cargarSharp() {
  const require = createRequire(import.meta.url)
  try {
    return require("sharp")
  } catch {
    const pnpm = join(REPO, "node_modules", ".pnpm")
    const carpeta = existsSync(pnpm) ? readdirSync(pnpm).find((d) => d.startsWith("sharp@")) : null
    if (!carpeta) throw new Error("No encontré sharp en node_modules. Instálalo o corre esto en otra máquina.")
    return require(join(pnpm, carpeta, "node_modules", "sharp"))
  }
}

const sharp = cargarSharp()
const kb = (n) => `${Math.round(n / 1024)} KB`
let antes = 0
let despues = 0
const convertidas = []

for (const sub of ["images", "products"]) {
  const carpeta = join(REPO, "public", sub)
  if (!existsSync(carpeta)) continue
  for (const nombre of readdirSync(carpeta).filter((f) => f.endsWith(".png"))) {
    const origen = join(carpeta, nombre)
    const destino = origen.replace(/\.png$/, ".webp")
    const r = await sharp(origen).webp({ quality: 80 }).toFile(destino)
    const tam = statSync(origen).size
    convertidas.push(`/${sub}/${nombre}`)
    antes += tam
    despues += r.size
    console.log(`  ${sub}/${nombre.padEnd(22)} ${kb(tam).padStart(7)} -> ${kb(r.size)}`)
  }
}

console.log(`\n  total ${kb(antes)} -> ${kb(despues)}\n`)

/**
 * La lista de las que tienen WebP, para que `fotoLigera` solo cambie esas.
 * Las rutas vienen de la base: si una foto nueva no pasó por aquí, se sigue
 * pidiendo el PNG en vez de un WebP que no existe.
 */
writeFileSync(
  join(REPO, "lib", "fotos-webp.ts"),
  "// Generado por scripts/a-webp.mjs. No editar a mano: correr el script.\n" +
    `export const FOTOS_CON_WEBP: ReadonlySet<string> = new Set(${JSON.stringify(
      convertidas.sort(),
      null,
      2,
    )})\n`,
)
console.log("  lib/fotos-webp.ts actualizado\n")
