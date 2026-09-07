#!/usr/bin/env node
/**
 * Qué claves viajan al navegador.
 *
 *   pnpm build && node scripts/auditar-bundle.mjs
 *
 * Todo lo que está en .next/static lo puede leer cualquiera con Inspeccionar.
 * No hay forma de esconder nada ahí: es el código que corre en la máquina del
 * visitante. Así que la pregunta no es si se puede ver, sino si lo que se ve
 * importa.
 *
 * La clave publicable de Supabase VA ahí a propósito. No es un descuido: el
 * navegador necesita hablar con la base, y lo que protege los datos no es
 * esconderla sino las políticas de RLS. Por eso existen auditar-tablas.mjs y
 * auditar-funciones.mjs, que revisan justamente eso.
 *
 * Lo que NO puede estar es la llave de servicio ni el token de la ruta de
 * pagos. Eso es lo que revisa esto.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const RAIZ = process.cwd()
const CLIENTE = join(RAIZ, ".next", "static")

/**
 * `sb_secret_` a secas aparece en la librería de Supabase, dentro de una
 * comprobación de prefijos. Lo que delata una clave de verdad es que venga
 * seguida de caracteres de clave.
 */
const PROHIBIDO = [
  {
    nombre: "clave secreta de Supabase",
    regex: /sb_secret_[A-Za-z0-9_-]{8,}/g,
  },
  {
    nombre: "token de la ruta de pagos",
    regex: /PAGOS_TOKEN["'\s]*[:=]\s*["'][^"']{8,}["']/g,
  },
  {
    nombre: "llave de servicio en una variable",
    regex: /SUPABASE_SERVICE_ROLE_KEY["'\s]*[:=]\s*["'][^"']{8,}["']/g,
  },
]

/** Un JWT cuyo cuerpo diga service_role es la llave maestra al desnudo. */
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./g

function archivos(carpeta) {
  const salida = []
  let entradas
  try {
    entradas = readdirSync(carpeta)
  } catch {
    return salida
  }

  for (const entrada of entradas) {
    const ruta = join(carpeta, entrada)
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta))
    else if (/\.(js|json|html|css)$/.test(entrada)) salida.push(ruta)
  }
  return salida
}

const lista = archivos(CLIENTE)

if (lista.length === 0) {
  console.error("No hay nada en .next/static. Corre `pnpm build` primero.")
  process.exit(1)
}

console.log(`\nRevisando ${lista.length} archivos que se descargan al navegador\n`)

const hallazgos = []
let conPublicable = 0

for (const ruta of lista) {
  const texto = readFileSync(ruta, "utf8")
  const corto = relative(RAIZ, ruta)

  if (/sb_publishable_[A-Za-z0-9_-]{8,}/.test(texto)) conPublicable++

  for (const { nombre, regex } of PROHIBIDO) {
    const encontrados = texto.match(regex)
    if (encontrados) hallazgos.push({ corto, nombre, muestra: encontrados[0].slice(0, 24) })
  }

  for (const jwt of texto.match(JWT) ?? []) {
    try {
      const cuerpo = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString())
      if (cuerpo.role === "service_role") {
        hallazgos.push({ corto, nombre: "JWT de service_role", muestra: jwt.slice(0, 24) })
      }
    } catch {
      // No era un JWT de verdad; el patrón es amplio a propósito.
    }
  }
}

console.log(
  `  clave publicable: ${conPublicable === 0 ? "no aparece" : `en ${conPublicable} archivo(s)`}` +
    "  (va ahí a propósito: el navegador la necesita)\n",
)

if (hallazgos.length === 0) {
  console.log("  \x1b[32mNinguna clave secreta viaja al navegador.\x1b[0m\n")
} else {
  for (const h of hallazgos) {
    console.log(`  \x1b[31mFUGA\x1b[0m ${h.nombre} en ${h.corto}`)
    console.log(`       empieza con: ${h.muestra}...`)
  }
  console.log(
    "\n  Hay que rotar esa clave desde Supabase AHORA: ya la tiene cualquiera\n" +
      "  que haya abierto la página.\n",
  )
  process.exitCode = 1
}
