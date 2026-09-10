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

/**
 * El dominio no se escribe aquí: ya cambió una vez -- de
 * grocery-delivery-interface a abastoweb -- y este archivo se quedó nombrando
 * el viejo, mandando a permitir una URL que ya no existe. Sale de la variable
 * de entorno, la misma que usa la app para armar sus enlaces absolutos.
 */
const sitio =
  env.NEXT_PUBLIC_SITE_URL ??
  (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : null)

warn("Las URLs de callback tienen que estar permitidas en URL Configuration:")
console.log("        http://localhost:3000/auth/callback")
if (sitio) {
  console.log(`        ${sitio}/auth/callback`)
} else {
  console.log("        https://TU-DOMINIO/auth/callback")
  console.log("        (sale de NEXT_PUBLIC_SITE_URL; en Vercel lo pone el propio despliegue)")
}

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

// ------------------------------------------------- listo para vender hoy

/**
 * Lo de arriba comprueba que la casa esté construida. Esto, que se pueda abrir
 * hoy: sin tasa cargada el pago móvil no se le ofrece a nadie, y sin método de
 * pago activo no hay con qué cobrar. Son las dos cosas que dejan la app en pie
 * y sin poder vender, y no se notan mirando el código.
 */
title("Listo para vender hoy")

const ajustes = await fetch(
  `${url}/rest/v1/settings?id=eq.global&select=rate_ves,rate_ves_updated_at,rate_ves_source`,
  { headers },
)
  .then((r) => (r.ok ? r.json() : null))
  .then((filas) => filas?.[0] ?? null)
  .catch(() => null)

if (!ajustes) {
  falla("No se pudieron leer los ajustes.")
} else if (!ajustes.rate_ves) {
  falla("Sin tasa cargada: el pago móvil no se le ofrece al cliente.")
} else {
  const cuando = ajustes.rate_ves_updated_at ? new Date(ajustes.rate_ves_updated_at) : null
  const dias = cuando ? Math.floor((Date.now() - cuando.getTime()) / 86400000) : null
  const de = ajustes.rate_ves_source === "manual" ? "a mano" : "del BCV"

  if (dias == null) warn(`Tasa Bs ${ajustes.rate_ves} cargada, pero sin fecha.`)
  else if (dias >= 2)
    falla(
      `La tasa (Bs ${ajustes.rate_ves}, ${de}) lleva ${dias} días sin actualizarse ` +
        "y se está cobrando con ella.",
    )
  else ok(`Tasa Bs ${ajustes.rate_ves} ${de}, de hace ${dias === 0 ? "menos de un día" : "un día"}.`)
}

const metodos = await fetch(
  `${url}/rest/v1/payment_methods?select=id,label,active,needs_reference,currency&order=sort_order`,
  { headers },
)
  .then((r) => (r.ok ? r.json() : []))
  .catch(() => [])

const activos = metodos.filter((m) => m.active)

if (activos.length === 0) {
  falla("Ningún método de pago activo: no hay con qué cobrar.")
} else {
  for (const m of activos) {
    const enBs = m.currency === "VES"

    // Activo no es lo mismo que ofrecido: además hace falta la tasa si cobra en
    // bolívares, y tener cargado a dónde paga el cliente si pide referencia.
    // Lo segundo no se ve sin sesión, así que se dice en vez de darlo por hecho.
    if (enBs && !ajustes?.rate_ves) {
      falla(`${m.label} está activo pero no se le ofrece a nadie: falta la tasa.`)
    } else if (m.needs_reference) {
      warn(`${m.label} activo. Se ofrece solo si tiene cargado a dónde pagar.`)
    } else {
      ok(`${m.label} activo, y se ofrece: se paga en la puerta.`)
    }
  }
}

/**
 * Lo que desde aquí no se puede ver, y conviene decirlo en vez de callarlo: a
 * dónde paga el cliente está reservado a quien inició sesión (ver la 0031), y
 * los roles tampoco se leen sin sesión.
 */
warn("Sin sesión no se ve si los datos de cobro están cargados ni si hay algún shopper.")
warn("Eso se mira entrando a Administración, en Cobros y en Usuarios.")


console.log(
  problemas === 0
    ? "\nTodo en orden.\n"
    : `\n${problemas} ${problemas === 1 ? "cosa" : "cosas"} por resolver.\n`,
)
process.exit(problemas === 0 ? 0 : 1)
