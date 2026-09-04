#!/usr/bin/env node
/**
 * Qué puede leer y escribir en cada tabla alguien que NO inició sesión.
 *
 *   node scripts/auditar-tablas.mjs
 *
 * Hermano de auditar-funciones.mjs, y por el mismo motivo: mide contra la base
 * en vez de leer las migraciones. Un archivo puede decir que una política
 * existe y la base tener otra cosa -- ya nos pasó con deliver_order.
 *
 * Lo que se espera de cada tabla está escrito abajo, así que el script no solo
 * informa: falla cuando la base no coincide con lo que debería ser.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

/**
 * `lee` es qué debería poder leer un anónimo:
 *   "todo"  el catálogo público. Tiene que verse sin cuenta.
 *   "nada"  datos de personas o pedidos.
 */
const TABLAS = [
  { nombre: "stores", lee: "todo", porque: "el inicio se ve sin cuenta" },
  { nombre: "products", lee: "todo", porque: "el catálogo se ve sin cuenta" },
  { nombre: "settings", lee: "todo", porque: "el checkout necesita la tarifa" },
  { nombre: "payment_methods", lee: "todo", porque: "el checkout los lista" },
  { nombre: "profiles", lee: "nada", porque: "son datos de personas" },
  { nombre: "addresses", lee: "nada", porque: "es dónde vive la gente" },
  { nombre: "orders", lee: "nada", porque: "son las compras de cada quien" },
  { nombre: "order_items", lee: "nada", porque: "es qué compró cada quien" },
  { nombre: "order_messages", lee: "nada", porque: "es el chat privado" },
  { nombre: "order_delivery_codes", lee: "nada", porque: "es la llave de la entrega" },
  { nombre: "payments_received", lee: "nada", porque: "son movimientos de dinero" },
  { nombre: "favorites", lee: "nada", porque: "es de cada cuenta" },
]

function leerEnv() {
  const texto = readFileSync(resolve(process.cwd(), ".env.local"), "utf8")
  const env = {}
  for (const linea of texto.split("\n")) {
    const l = linea.trim()
    if (!l || l.startsWith("#")) continue
    const i = l.indexOf("=")
    if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim()
  }
  return env
}

const env = leerEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o la clave publicable en .env.local")
  process.exit(1)
}

const cab = { apikey: key, Authorization: `Bearer ${key}` }
let problemas = 0

console.log("\nLectura sin sesión\n")

for (const tabla of TABLAS) {
  const r = await fetch(`${url}/rest/v1/${tabla.nombre}?select=*&limit=3`, { headers: cab })
  const cuerpo = await r.text()

  let filas = null
  try {
    const json = JSON.parse(cuerpo)
    if (Array.isArray(json)) filas = json.length
  } catch {
    // Un error viene como objeto, no como arreglo.
  }

  const debeLeer = tabla.lee === "todo"

  if (filas === null) {
    // Ni siquiera pudo consultar: para las privadas está bien.
    if (debeLeer) {
      problemas++
      console.log(`  \x1b[31mMAL\x1b[0m  ${tabla.nombre.padEnd(22)} no se puede leer y debería`)
    } else {
      console.log(`  \x1b[32mok\x1b[0m   ${tabla.nombre.padEnd(22)} bloqueada`)
    }
    continue
  }

  if (debeLeer) {
    console.log(`  \x1b[32mok\x1b[0m   ${tabla.nombre.padEnd(22)} abierta a propósito (${tabla.porque})`)
  } else if (filas === 0) {
    // RLS no da error: devuelve cero filas. Eso es lo correcto aquí.
    console.log(`  \x1b[32mok\x1b[0m   ${tabla.nombre.padEnd(22)} devuelve vacío`)
  } else {
    problemas++
    console.log(
      `  \x1b[31mFUGA\x1b[0m ${tabla.nombre.padEnd(22)} devolvió ${filas} filas y ${tabla.porque}`,
    )
  }
}

console.log("\nColumnas reservadas\n")

/**
 * Hay tablas públicas con una columna que no debe serlo. No alcanza con mirar
 * si el valor viene vacío: viene vacío también cuando el dato todavía no está
 * cargado, y así una fuga parece cerrada. Se comprueba que PEDIR la columna
 * rebote.
 */
const COLUMNAS = [
  {
    tabla: "payment_methods",
    columna: "instructions",
    porque: "es el teléfono, el banco y la cédula de quien cobra",
  },
]

for (const { tabla, columna, porque } of COLUMNAS) {
  const r = await fetch(`${url}/rest/v1/${tabla}?select=${columna}&limit=1`, { headers: cab })
  const cuerpo = await r.text()

  if (cuerpo.includes("permission denied")) {
    console.log(`  \x1b[32mok\x1b[0m   ${tabla}.${columna} reservada`)
  } else {
    problemas++
    console.log(`  \x1b[31mFUGA\x1b[0m ${tabla}.${columna} la lee un anónimo, y ${porque}`)
    console.log(`         (HTTP ${r.status}: ${cuerpo.slice(0, 60)})`)
  }
}

console.log("\nEscritura sin sesión\n")

// Insertar en las que guardan cosas de personas tiene que rebotar.
for (const nombre of ["orders", "profiles", "addresses", "payments_received", "products"]) {
  const r = await fetch(`${url}/rest/v1/${nombre}`, {
    method: "POST",
    headers: { ...cab, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: "{}",
  })

  if (r.status === 201) {
    problemas++
    console.log(`  \x1b[31mFUGA\x1b[0m ${nombre.padEnd(22)} dejó insertar sin sesión`)
  } else {
    console.log(`  \x1b[32mok\x1b[0m   ${nombre.padEnd(22)} rechaza (HTTP ${r.status})`)
  }
}

if (problemas === 0) {
  console.log("\nNada al alcance de un anónimo que no deba estarlo.\n")
} else {
  console.log(`\n${problemas} ${problemas === 1 ? "problema" : "problemas"} arriba.\n`)
  process.exitCode = 1
}
