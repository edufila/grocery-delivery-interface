#!/usr/bin/env node
// Verifica que .env.local apunte a un Supabase real y que estén prendidos
// los proveedores que usa el login. Correr con: pnpm check:supabase
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const ok = (msg) => console.log(`  \x1b[32mOK\x1b[0m    ${msg}`)
const bad = (msg) => console.log(`  \x1b[31mFALTA\x1b[0m ${msg}`)
const warn = (msg) => console.log(`  \x1b[33mAVISO\x1b[0m ${msg}`)

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

console.log("\nRevisando la configuración de Supabase\n")

const env = leerEnv()
if (!env) {
  bad("No existe .env.local. Copiá .env.local.example y completalo.")
  process.exit(1)
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
let problemas = 0

if (!url) {
  bad("NEXT_PUBLIC_SUPABASE_URL está vacía.")
  problemas++
} else if (!/^https:\/\/.+\.supabase\.(co|in)$/.test(url)) {
  warn(`NEXT_PUBLIC_SUPABASE_URL tiene una pinta rara: ${url}`)
} else {
  ok(`URL del proyecto: ${url}`)
}

if (!key) {
  bad("NEXT_PUBLIC_SUPABASE_ANON_KEY está vacía.")
  problemas++
} else if (key.length < 40) {
  warn("La anon key parece demasiado corta. Revisá que la copiaste entera.")
} else {
  ok("Anon key cargada.")
}

if (problemas > 0) {
  console.log("\nCompletá esos valores y volvé a correr esto.\n")
  process.exit(1)
}

let settings
try {
  const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
  if (res.status === 401) {
    bad("Supabase rechazó la anon key (401). Revisá que sea la 'anon public' del proyecto.")
    process.exit(1)
  }
  if (!res.ok) {
    bad(`Supabase respondió ${res.status}. Revisá que la URL sea la correcta.`)
    process.exit(1)
  }
  settings = await res.json()
  ok("Conexión con Supabase establecida.")
} catch (error) {
  bad(`No se pudo conectar con ${url}`)
  console.log(`        ${error.message}`)
  process.exit(1)
}

console.log("\nProveedores de login\n")

const google = settings.external?.google === true
const email = settings.external?.email === true

if (google) ok("Google está habilitado.")
else {
  bad("Google está deshabilitado. Authentication → Sign In / Providers → Google.")
  problemas++
}

if (email) ok("El ingreso por email está habilitado.")
else {
  bad("El email está deshabilitado. Authentication → Sign In / Providers → Email.")
  problemas++
}

// El enlace del correo y la vuelta de Google mueren si la URL no está permitida.
warn("En Authentication → URL Configuration tienen que estar permitidas las URLs de callback:")
console.log("        http://localhost:3000/auth/callback")
console.log("        https://grocery-delivery-interface.vercel.app/auth/callback")

if (settings.disable_signup === true) {
  warn("Los registros nuevos están deshabilitados: solo van a poder entrar usuarios ya existentes.")
}

console.log(
  problemas === 0
    ? "\nTodo listo. Reiniciá el server de desarrollo y probá /login\n"
    : "\nResolvé lo marcado como FALTA y volvé a correr esto.\n",
)
process.exit(problemas === 0 ? 0 : 1)
