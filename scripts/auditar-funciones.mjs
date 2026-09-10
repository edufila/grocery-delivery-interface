#!/usr/bin/env node
/**
 * Qué funciones de la base puede invocar alguien que NO inició sesión.
 *
 *   node scripts/auditar-funciones.mjs
 *
 * Existe porque Supabase concede EXECUTE a `anon` por defecto en toda función
 * nueva del esquema public. Cada `create function` que se olvide de revocar
 * después queda abierta al mundo, y como las nuestras son `security definer`
 * -- se saltan RLS a propósito -- una abierta es una puerta sin llave.
 *
 * Ya pasó una vez: conciliar_pedido quedó abierta al crearla, y deliver_order
 * apareció abierta en la base pese a que su migración la revocaba.
 *
 * Correrlo después de cada migración que cree funciones.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const CERO = "00000000-0000-0000-0000-000000000000"

/**
 * Se llama a cada función con argumentos válidos pero inofensivos. Llamarlas
 * sin argumentos no sirve: PostgREST responde "no existe" cuando lo que no
 * existe es esa combinación de parámetros, y parecería que faltan todas.
 */
const FUNCIONES = [
  ["soy_dev", {}],
  ["admin_set_role", { p_user: CERO, p_role: "cliente" }],
  ["admin_set_handle", { p_user: CERO, p_handle: "x" }],
  ["admin_set_identity", { p_user: CERO, p_full_name: "x", p_avatar_url: "" }],
  ["place_order", { p_items: [], p_address_id: CERO, p_payment_method: "x", p_substitution: "x" }],
  ["deliver_order", { p_order_id: CERO, p_code: "0000" }],
  ["reset_delivery_code", { p_order_id: CERO }],
  ["shopper_release_order", { p_order_id: CERO }],
  ["shopper_cancel_order", { p_order_id: CERO, p_reason: "prueba larga" }],
  ["order_customer", { p_order_id: CERO }],
  ["order_shopper", { p_order_id: CERO }],
  ["report_payment", { p_order_id: CERO, p_reference: "1234" }],
  ["verify_payment", { p_order_id: CERO }],
  ["record_payment", { p_reference: "1234" }],
  ["conciliar_pedido", { p_order_id: CERO }],
  ["referencias_coinciden", { p_reportada: "1234", p_recibida: "1234" }],
  ["avisos_pendientes", {}],
  ["pago_resuelto", { p_required: true, p_verified: null }],
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

/**
 * Las que TIENEN que estar abiertas, y por qué.
 *
 * Sin esta lista el auditor las marcaba en rojo y cerraba diciendo "revocarlas
 * con revoke execute...". Quien le hiciera caso volvería a romper justo lo que
 * arregló la 0038: una función que se usa dentro de una política de RLS la
 * ejecuta el rol de quien consulta, así que revocársela a `anon` no cierra nada
 * -- la tabla ya está cerrada por la política -- y en cambio convierte el
 * bloqueo limpio en un error que además dice el nombre de la función.
 *
 * Una alarma que pide hacer daño es peor que no tener alarma.
 */
const ABIERTAS_A_PROPOSITO = {
  pago_resuelto:
    "la usan las políticas de orders y order_items, y una política se evalúa " +
    "con el rol de quien consulta (ver 0038). No lee ninguna tabla: recibe un " +
    "booleano y una fecha, y devuelve un booleano.",
}

const env = leerEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o la clave publicable en .env.local")
  process.exit(1)
}

const cab = { apikey: key, "Content-Type": "application/json", Authorization: `Bearer ${key}` }

console.log("\nFunciones al alcance de alguien sin sesión\n")

let abiertas = 0

for (const [nombre, args] of FUNCIONES) {
  const r = await fetch(`${url}/rest/v1/rpc/${nombre}`, {
    method: "POST",
    headers: cab,
    body: JSON.stringify(args),
  })
  const cuerpo = await r.text()

  if (cuerpo.includes("Could not find the function")) {
    console.log(`  \x1b[90m—\x1b[0m      ${nombre.padEnd(24)} no existe todavía`)
  } else if (cuerpo.includes("permission denied for function")) {
    // Que una de las que tienen que estar abiertas aparezca cerrada también es
    // una alarma: significa que alguien la revocó y la app quedó rota.
    if (ABIERTAS_A_PROPOSITO[nombre]) {
      abiertas++
      console.log(
        `  \x1b[31mCERRADA\x1b[0m ${nombre.padEnd(24)} y tenía que estar abierta:\n` +
          `          ${ABIERTAS_A_PROPOSITO[nombre]}`,
      )
    } else {
      console.log(`  \x1b[32mcerrada\x1b[0m ${nombre}`)
    }
  } else if (r.status === 200) {
    const porque = ABIERTAS_A_PROPOSITO[nombre]

    if (porque) {
      console.log(`  \x1b[32mabierta\x1b[0m ${nombre.padEnd(24)} a propósito:\n          ${porque}`)
    } else {
      abiertas++
      console.log(`  \x1b[31mABIERTA\x1b[0m ${nombre.padEnd(24)} respondió: ${cuerpo.slice(0, 60)}`)
    }
  } else {
    console.log(`  \x1b[33m?\x1b[0m      ${nombre.padEnd(24)} HTTP ${r.status}: ${cuerpo.slice(0, 60)}`)
  }
}

if (abiertas === 0) {
  console.log("\nNinguna función queda al alcance de un anónimo.\n")
} else {
  console.log(
    `\n${abiertas} ${abiertas === 1 ? "función abierta" : "funciones abiertas"}. ` +
      "Revocarlas con:\n" +
      "  revoke execute on function public.<nombre>(<tipos>) from public, anon;\n",
  )
  process.exitCode = 1
}
