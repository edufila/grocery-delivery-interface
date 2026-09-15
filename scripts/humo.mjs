#!/usr/bin/env node
/**
 * Prueba de humo: ¿la app que está en línea funciona?
 *
 *   node scripts/humo.mjs                          contra abastoweb.vercel.app
 *   node scripts/humo.mjs http://localhost:3000    contra otra
 *
 * POR QUÉ. El código se despliega solo al hacer push, y lo que se rompe en un
 * despliegue no avisa: la pantalla queda en blanco o con "Se nos rompió algo"
 * hasta que alguien la abre. Esto abre las pantallas públicas como lo haría
 * un teléfono y mira que respondan y digan lo que tienen que decir. Tarda unos
 * segundos y no toca nada: solo lee.
 *
 * Lo que necesita sesión (perfil, panel, seguimiento) no se puede ver desde
 * aquí; se comprueba que redirija a Entrar, que es lo correcto sin sesión.
 */

const BASE = (process.argv[2] ?? "https://abastoweb.vercel.app").replace(/\/$/, "")
const TELEFONO =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36"

const verde = (t) => `\x1b[32m${t}\x1b[0m`
const rojo = (t) => `\x1b[31m${t}\x1b[0m`
const gris = (t) => `\x1b[90m${t}\x1b[0m`

/**
 * Cada chequeo: la ruta, qué tiene que contener la página, y qué no puede
 * contener. "Se nos rompió algo" es el texto de app/error.tsx.
 */
const CHEQUEOS = [
  { ruta: "/", debe: ["¿Qué te llevamos hoy?", "Abastos cercanos"] },
  { ruta: "/catalogo?tienda=girasol", debe: ["Catálogo", "Buscar en"] },
  { ruta: "/buscar", debe: ["Buscar en todos los abastos"] },
  { ruta: "/buscar?q=arroz", debe: ["encontrado"] },
  { ruta: "/login", debe: ["Tu mercado, sin salir de casa"] },
  { ruta: "/checkout", debe: ["Carrito y pago"] },
  { ruta: "/terminos", debe: ["Términos y privacidad", "Borrar tus datos"] },
  { ruta: "/sin-conexion", debe: ["Te quedaste sin señal"] },
  { ruta: "/manifest.webmanifest", debe: ['"short_name"'] },
  { ruta: "/sw.js", debe: ["abasto-v"] },
  { ruta: "/pedidos", redirige: "/login" },
  { ruta: "/perfil", redirige: "/login" },
  { ruta: "/admin", redirige: "/login" },
  { ruta: "/shopper", redirige: "/login" },
]

const NUNCA = ["Se nos rompió algo", "Application error", "Internal Server Error"]

let fallas = 0
console.log(`\nPrueba de humo contra ${BASE}\n`)

for (const chequeo of CHEQUEOS) {
  const inicio = Date.now()
  let linea = ""

  try {
    const respuesta = await fetch(BASE + chequeo.ruta, {
      headers: { "User-Agent": TELEFONO },
      redirect: chequeo.redirige ? "manual" : "follow",
    })
    const ms = Date.now() - inicio

    if (chequeo.redirige) {
      const destino = respuesta.headers.get("location") ?? ""
      const ok = respuesta.status >= 300 && respuesta.status < 400 && destino.includes(chequeo.redirige)
      linea = ok
        ? `${verde("ok")}     ${chequeo.ruta.padEnd(26)} ${gris(`-> ${chequeo.redirige}  ${ms} ms`)}`
        : `${rojo("FALLA")}  ${chequeo.ruta.padEnd(26)} esperaba ir a ${chequeo.redirige}, dio ${respuesta.status} ${destino}`
      if (!ok) fallas++
    } else {
      const html = await respuesta.text()
      const faltan = chequeo.debe.filter((t) => !html.includes(t))
      const rotos = NUNCA.filter((t) => html.includes(t))
      const ok = respuesta.ok && faltan.length === 0 && rotos.length === 0
      linea = ok
        ? `${verde("ok")}     ${chequeo.ruta.padEnd(26)} ${gris(`${respuesta.status}  ${ms} ms  ${Math.round(html.length / 1024)} KB`)}`
        : `${rojo("FALLA")}  ${chequeo.ruta.padEnd(26)} ${respuesta.status}${faltan.length ? ` · falta: ${faltan.join(", ")}` : ""}${rotos.length ? ` · aparece: ${rotos.join(", ")}` : ""}`
      if (!ok) fallas++
    }
  } catch (error) {
    fallas++
    linea = `${rojo("FALLA")}  ${chequeo.ruta.padEnd(26)} no respondió: ${error.message}`
  }

  console.log("  " + linea)
}

console.log(
  fallas === 0
    ? `\n${verde("Todo responde.")}\n`
    : `\n${rojo(`${fallas} ${fallas === 1 ? "falla" : "fallas"}.`)} Mira el último despliegue en Vercel.\n`,
)
process.exit(fallas === 0 ? 0 : 1)
