import { timingSafeEqual } from "node:crypto"

import { leerAvisoBanco } from "@/lib/aviso-banco"

/**
 * Recibe el aviso de un pago y lo registra.
 *
 * Es la puerta para automatizar lo último que queda manual: hoy alguien mira
 * el banco y escribe la referencia en el panel. Con esto, cualquier cosa que
 * pueda leer el aviso del banco -- un teléfono Android reenviando la
 * notificación, un script leyendo un correo, lo que sea -- llama aquí y el
 * pedido se verifica solo.
 *
 * Acepta el texto crudo del aviso, que es lo cómodo para quien reenvía, o el
 * monto y la referencia ya separados, que es lo confiable.
 *
 * Se apoya en los céntimos únicos: como no hay dos pedidos sin pagar con el
 * mismo monto, con el monto alcanza para saber cuál es. La referencia es el
 * respaldo para cuando alguien paga un monto distinto al cotizado.
 *
 * Ejemplo:
 *   curl -X POST https://.../api/pago-recibido \
 *     -H "Authorization: Bearer EL_TOKEN" \
 *     -H "Content-Type: application/json" \
 *     -d '{"texto":"Pago Movil recibido Bs. 847,91 Ref. 012345678"}'
 */

// Node y no Edge: hace falta timingSafeEqual.
export const runtime = "nodejs"

/**
 * Comparar con `===` tarda distinto según cuántos caracteres coincidan, y con
 * suficientes intentos eso deja adivinar el token letra por letra.
 */
function mismoToken(a: string, b: string) {
  const uno = Buffer.from(a)
  const dos = Buffer.from(b)
  if (uno.length !== dos.length) return false
  return timingSafeEqual(uno, dos)
}

function responder(cuerpo: object, status: number) {
  return Response.json(cuerpo, { status })
}

export async function POST(request: Request) {
  const token = process.env.PAGOS_TOKEN
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY

  /**
   * Sin configurar no atiende. Es a propósito: una ruta que registra pagos y
   * queda abierta porque falta una variable es peor que una que no existe.
   */
  if (!token || !url || !llave) {
    return responder({ error: "La ruta no está configurada" }, 503)
  }

  const cabecera = request.headers.get("authorization") ?? ""
  const enviado = cabecera.replace(/^Bearer\s+/i, "")

  if (!enviado || !mismoToken(enviado, token)) {
    return responder({ error: "Token inválido" }, 401)
  }

  let cuerpo: { texto?: string; referencia?: string; monto?: number; fuente?: string }
  try {
    cuerpo = await request.json()
  } catch {
    return responder({ error: "El cuerpo tiene que ser JSON" }, 400)
  }

  // Lo que venga separado manda sobre lo que se pueda leer del texto: si quien
  // reenvía ya sabe el monto, no hay razón para volver a adivinarlo.
  const leido = cuerpo.texto ? leerAvisoBanco(cuerpo.texto) : { referencia: null, monto: null }
  const referencia = cuerpo.referencia?.trim() || leido.referencia
  const monto = typeof cuerpo.monto === "number" ? cuerpo.monto : leido.monto

  if (!referencia) {
    return responder(
      {
        error: "No encontramos la referencia",
        // Se devuelve lo que sí se entendió: es lo que permite arreglar el
        // reenvío sin tener que adivinar qué falló.
        leido,
      },
      422,
    )
  }

  const respuesta = await fetch(`${url}/rest/v1/rpc/record_payment`, {
    method: "POST",
    headers: {
      apikey: llave,
      Authorization: `Bearer ${llave}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_reference: referencia,
      p_amount: monto,
      p_raw: cuerpo.texto ?? null,
      p_source: cuerpo.fuente ?? "webhook",
    }),
  })

  const datos = await respuesta.json().catch(() => null)

  if (!respuesta.ok) {
    return responder({ error: "La base rechazó el pago", detalle: datos }, 502)
  }

  return responder({ ...datos, referencia, monto }, 200)
}
