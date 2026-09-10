import { timingSafeEqual } from "node:crypto"

/**
 * Trae la tasa oficial del BCV y la deja cargada en `settings.rate_ves`, para
 * no depender de que un admin se acuerde de escribirla todos los días.
 *
 * La pega Vercel Cron una vez al día (ver `vercel.json`). Vercel manda
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

const FUENTE_BCV = "https://ve.dolarapi.com/v1/dolares/oficial"

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

  const fuente = await fetch(FUENTE_BCV, { cache: "no-store" }).catch(() => null)
  const datos = fuente && fuente.ok ? await fuente.json().catch(() => null) : null

  const tasa = Number(datos?.promedio)

  if (!fuente?.ok || !Number.isFinite(tasa) || tasa <= 0) {
    return responder({ error: "El BCV no respondió con una tasa usable", detalle: datos }, 502)
  }

  /**
   * Que no entre una tasa de otro orden de magnitud.
   *
   * "Un número positivo" no alcanza como comprobación cuando ese número
   * multiplica todos los precios de la app. Si la fuente devuelve 8,2 en vez de
   * 820 -- un punto decimal corrido, un cambio de formato, una respuesta de
   * error que casualmente parsea -- un pedido de $3,50 se cotizaría en Bs 28 en
   * lugar de Bs 2.870. Se vendería a una centésima del precio, solo, de
   * madrugada y sin que nadie mire.
   *
   * El límite es un factor de dos y no un porcentaje: la tasa aquí se mueve, y
   * a veces salta fuerte, así que un tope estrecho rechazaría movimientos
   * legítimos. Duplicarse o partirse a la mitad de un día para otro no es un
   * movimiento, es un error de dato.
   *
   * Rechazar tiene su costo -- se sigue cobrando con la tasa vieja -- pero es
   * un costo acotado y visible: la app muestra de cuándo es la tasa que está
   * usando, y un admin la puede escribir a mano. Aceptar basura no tiene fondo.
   */
  const anterior = await fetch(`${url}/rest/v1/settings?id=eq.global&select=rate_ves`, {
    headers: { apikey: llave, Authorization: `Bearer ${llave}` },
    cache: "no-store",
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((filas) => Number(filas?.[0]?.rate_ves))
    .catch(() => Number.NaN)

  if (Number.isFinite(anterior) && anterior > 0 && (tasa > anterior * 2 || tasa < anterior / 2)) {
    return responder(
      {
        error: "La tasa nueva es de otro orden que la anterior, así que no se aplicó",
        anterior,
        recibida: tasa,
        que_hacer: "Comprobarla contra el BCV y, si es real, cargarla a mano desde el panel.",
      },
      409,
    )
  }

  const respuesta = await fetch(`${url}/rest/v1/settings?id=eq.global`, {
    method: "PATCH",
    headers: {
      apikey: llave,
      Authorization: `Bearer ${llave}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      rate_ves: tasa,
      rate_ves_updated_at: new Date().toISOString(),
      rate_ves_source: "bcv",
    }),
  })

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => null)
    return responder({ error: "No pudimos guardar la tasa", detalle }, 502)
  }

  return responder({ ok: true, rate_ves: tasa, fecha_bcv: datos.fechaActualizacion }, 200)
}
