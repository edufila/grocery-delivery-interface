#!/usr/bin/env node
// Revisión de salud del proyecto: conexión, proveedores de login, tablas,
// tiendas ubicadas, catálogo y bucket de fotos.
//
// Correr con: pnpm check:supabase
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const ok = (msg) => console.log(`  \x1b[32mOK\x1b[0m    ${msg}`)
const bad = (msg) => console.log(`  \x1b[31mFALTA\x1b[0m ${msg}`)
const warn = (msg) => console.log(`  \x1b[33mAVISO\x1b[0m ${msg}`)
const title = (msg) => console.log(`\n${msg}\n`)

let problemas = 0
const falla = (msg) => {
  bad(msg)
  problemas++
}

function leerEnv() {
  try {
    const texto = readFileSync(resolve(process.cwd(), ".env.local"), "utf8")
    const vars = {}
    for (const linea of texto.split("\n")) {
      const limpia = linea.trim()
      if (!limpia || limpia.startsWith("#")) continue
      const i = limpia.indexOf("=")
      if (i === -1) continue
      vars[limpia.slice(0, i).trim()] = limpia.slice(i + 1).trim()
    }
    return vars
  } catch {
    return null
  }
}

title("Configuración")

const env = leerEnv()
if (!env) {
  bad("No existe .env.local. Copiá .env.local.example y completalo.")
  process.exit(1)
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  bad("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.")
  process.exit(1)
}
ok(`Proyecto: ${url}`)

const headers = { apikey: key, Authorization: `Bearer ${key}` }

async function api(path) {
  const res = await fetch(`${url}${path}`, { headers })
  return { status: res.status, body: res.ok ? await res.json() : null }
}

// ------------------------------------------------------------ proveedores

let settings
try {
  const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
  if (!res.ok) {
    bad(`Supabase respondió ${res.status}. Revisá la URL y la anon key.`)
    process.exit(1)
  }
  settings = await res.json()
  ok("Conexión establecida.")
} catch (error) {
  bad(`No se pudo conectar: ${error.message}`)
  process.exit(1)
}

title("Login")

if (settings.external?.google) ok("Google habilitado.")
else falla("Google deshabilitado. Authentication → Sign In / Providers.")

if (settings.external?.email) ok("Email habilitado.")
else falla("Email deshabilitado. Authentication → Sign In / Providers.")

warn("Las URLs de callback tienen que estar permitidas en URL Configuration:")
console.log("        http://localhost:3000/auth/callback")
console.log("        https://grocery-delivery-interface.vercel.app/auth/callback")

// ------------------------------------------------------------ esquema

title("Tablas")

const TABLAS = [
  "profiles",
  "addresses",
  "stores",
  "products",
  "orders",
  "order_items",
  "order_delivery_codes",
  "order_messages",
  "favorites",
  "settings",
]

for (const tabla of TABLAS) {
  const { status } = await api(`/rest/v1/${tabla}?select=*&limit=1`)
  if (status === 200) ok(tabla)
  else falla(`${tabla} no existe. Falta correr alguna migración.`)
}

// ------------------------------------------------------------ contenido

title("Contenido")

const { body: stores } = await api("/rest/v1/stores?select=id,name,lat,lng,active")
if (stores) {
  for (const store of stores) {
    if (!store.active) {
      warn(`${store.name} está oculta en el inicio.`)
    } else if (store.lat == null || store.lng == null) {
      falla(`${store.name} no tiene punto en el mapa: no se le puede trazar ruta al shopper.`)
    } else {
      ok(`${store.name} ubicada en ${Number(store.lat).toFixed(5)}, ${Number(store.lng).toFixed(5)}`)
    }
  }
}

const { body: products } = await api("/rest/v1/products?select=store_id,active")
if (products) {
  const porTienda = {}
  for (const p of products) {
    if (!p.active) continue
    porTienda[p.store_id] = (porTienda[p.store_id] ?? 0) + 1
  }
  for (const store of stores ?? []) {
    const cuantos = porTienda[store.id] ?? 0
    if (cuantos === 0) warn(`${store.name} no tiene productos activos: su catálogo sale vacío.`)
    else ok(`${store.name}: ${cuantos} productos activos`)
  }
}

// ------------------------------------------------------------ fotos

title("Fotos")

const bucket = await fetch(`${url}/storage/v1/object/list/fotos`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({ prefix: "", limit: 1 }),
})

if (bucket.ok) ok("Bucket de fotos creado.")
else falla("Falta el bucket de fotos. Correr la migración de storage.")

console.log(
  problemas === 0
    ? "\nTodo en orden.\n"
    : `\n${problemas} ${problemas === 1 ? "cosa" : "cosas"} por resolver.\n`,
)
process.exit(problemas === 0 ? 0 : 1)
