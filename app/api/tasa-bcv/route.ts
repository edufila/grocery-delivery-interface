import { timingSafeEqual } from "node:crypto"

import { refrescarTasa } from "@/lib/refrescar-tasa"

/**
 * Trae la tasa oficial del BCV y la deja cargada en `settings.rate_ves`, para
 * no depender de que un admin se acuerde de escribirla todos los días.
 *
 * La pega Vercel Cron una vez al día (ver `vercel.json`). Como una vez al día no
 * alcanza, las pantallas también la revisan solas cada hora (lib/refrescar-tasa.ts). Vercel manda
 * `Authorization: Bearer $CRON_SECRET` solo si esa variable está configurada,
 * así que sirve igual que el token de `pago-recibido`: sin ella, la ruta no
 * atiende a nadie.
 *
 * Si la fuente falla o responde algo que no es un número usable, no se toca
 * la tasa que ya había: mejor seguir cobrando con la última que sí se pudo
 * traer que con un cero o un error a mitad de cargar. `rate_ves_updated_at`
 * es lo que le permite a la app avisar si esa tasa quedó vieja.
 */

// Node y no Edge: hace falta timingSafeEqual.
export const runtime = "nodejs"

function mismoToken(a: string, b: string) {
  const uno = Buffer.from(a)
  const dos = Buffer.from(b)
  if (uno.length !== dos.length) return false
  return timingSafeEqual(uno, dos)
}

function responder(cuerpo: object, status: number) {
  return Response.json(cuerpo, { status })
}

export async function GET(request: Request) {
  const token = process.env.CRON_SECRET
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!token || !url || !llave) {
    return responder({ error: "La ruta no está configurada" }, 503)
  }

  const cabecera = request.headers.get("authorization") ?? ""
  const enviado = cabecera.replace(/^Bearer\s+/i, "")

  if (!enviado || !mismoToken(enviado, token)) {
    return responder({ error: "Token inválido" }, 401)
  }

  // La decisión (tasa usable, que rija desde hoy, mismo orden que la anterior,
  // respetar una manual reciente) vive en lib/tasa-bcv.ts, con tests. Es la
  // misma que usan las pantallas al revisarla solas cada hora.
  const resultado = await refrescarTasa({ forzar: true })

  switch (resultado.estado) {
    case "aplicada":
      return responder({ ok: true, rate_ves: resultado.tasa, anterior: resultado.anterior, fecha_bcv: resultado.vigenteDesde }, 200)
    case "esperar":
      return responder({ ok: true, sin_cambios: resultado.motivo, recibida: resultado.recibida }, 200)
    case "rechazada":
      return responder(
        {
          error: resultado.motivo,
          anterior: resultado.anterior,
          recibida: resultado.recibida,
          que_hacer: "Comprobarla contra el BCV y, si es real, cargarla a mano desde el panel.",
        },
        409,
      )
    case "sin-configurar":
      return responder({ error: "La ruta no está configurada" }, 503)
    default:
      return responder({ error: "No pudimos actualizar la tasa", detalle: "motivo" in resultado ? resultado.motivo : null }, 502)
  }
}
