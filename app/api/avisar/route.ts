import { createClient } from "@/lib/supabase/server"
import { hayVapid, mandarPush, type Suscripcion } from "@/lib/push-servidor"

/**
 * Despierta el teléfono de quien tiene que hacer algo.
 *
 * Los avisos que ya existían solo suenan con la pantalla abierta: son el propio
 * navegador reaccionando a un cambio. Esto es lo otro, lo que llega con la app
 * cerrada y el teléfono en el bolsillo.
 *
 * Dos momentos, que son los dos puntos donde la cadena se detiene esperando a
 * una persona:
 *
 *   pago-reportado  el cliente dice que pagó -> se despierta a admin y dev,
 *                   porque hasta que uno confirme, el pedido no sale.
 *   pedido-listo    el pago quedó confirmado -> se despierta a los shoppers,
 *                   que recién ahora pueden tomarlo.
 *
 * QUIÉN PUEDE DISPARAR CADA UNO no sale del cuerpo de la petición sino de lo
 * que la persona realmente tiene: para el primero hay que tener un pedido
 * propio con pago reportado y sin verificar; para el segundo, ser admin o dev.
 * Si dependiera de lo que dice el cuerpo, cualquiera con sesión podría hacer
 * sonar todos los teléfonos del equipo cuando quisiera.
 *
 * El golpe va sin contenido y el service worker pregunta qué mostrar: ver
 * `lib/push-servidor.ts` y `/api/aviso-pendiente`.
 */

// Node y no Edge: la firma del JWT usa node:crypto.
export const runtime = "nodejs"

type Motivo = "pago-reportado" | "pedido-listo"

const ROLES_DESTINO: Record<Motivo, string[]> = {
  "pago-reportado": ["admin", "dev"],
  // admin y dev también toman pedidos, así que también les llega.
  "pedido-listo": ["shopper", "admin", "dev"],
}

/**
 * Cuándo se avisó por última vez de cada motivo.
 *
 * Sin esto, una pantalla con un error de reintento haría vibrar todos los
 * teléfonos del equipo cada pocos segundos. Vive en memoria del proceso, así
 * que no es una garantía: es lo suficiente para que un accidente no se vuelva
 * un castigo, y lo barato para no meter otra tabla en el medio.
 */
const ultimoAviso = new Map<Motivo, number>()
const ESPERA_MS = 45_000

function servicio() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !llave) return null

  return async (ruta: string, init?: RequestInit) =>
    fetch(`${url}/rest/v1/${ruta}`, {
      ...init,
      headers: {
        apikey: llave,
        Authorization: `Bearer ${llave}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    })
}

export async function POST(request: Request) {
  if (!hayVapid()) {
    return Response.json({ error: "Faltan las claves VAPID" }, { status: 503 })
  }

  const rest = servicio()
  if (!rest) {
    return Response.json({ error: "Falta la llave de servicio" }, { status: 503 })
  }

  let motivo: Motivo
  try {
    const cuerpo = (await request.json()) as { motivo?: string }
    if (cuerpo.motivo !== "pago-reportado" && cuerpo.motivo !== "pedido-listo") {
      return Response.json({ error: "Motivo desconocido" }, { status: 400 })
    }
    motivo = cuerpo.motivo
  } catch {
    return Response.json({ error: "El cuerpo tiene que ser JSON" }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return Response.json({ error: "Hace falta sesión" }, { status: 401 })

  // ------------------------------------------- ¿esta persona puede pedir esto?

  if (motivo === "pago-reportado") {
    // Con el cliente de la sesión: RLS ya limita a los pedidos propios, así que
    // encontrar uno es la prueba de que hay algo real que avisar.
    const { data } = await supabase
      .from("orders")
      .select("id")
      .eq("user_id", user.id)
      .not("payment_reported_at", "is", null)
      .is("payment_verified_at", null)
      .limit(1)

    if (!data?.length) {
      return Response.json({ enviados: 0, nota: "no hay nada que avisar" }, { status: 200 })
    }
  } else {
    const { data: perfil } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle<{ role: string }>()

    if (!perfil || !["admin", "dev"].includes(perfil.role)) {
      return Response.json({ error: "No tienes permiso" }, { status: 403 })
    }
  }

  const desde = ultimoAviso.get(motivo) ?? 0
  if (Date.now() - desde < ESPERA_MS) {
    return Response.json({ enviados: 0, nota: "se avisó hace poco" }, { status: 200 })
  }
  ultimoAviso.set(motivo, Date.now())

  // ------------------------------------------------------- a quién despertar

  const roles = ROLES_DESTINO[motivo].join(",")
  const respPerfiles = await rest(`profiles?select=id&role=in.(${roles})`)
  const perfiles = (await respPerfiles.json().catch(() => [])) as { id: string }[]

  // A quien disparó el aviso no se le avisa: ya está mirando la pantalla.
  const destinos = Array.isArray(perfiles)
    ? perfiles.map((p) => p.id).filter((id) => id !== user.id)
    : []

  if (destinos.length === 0) return Response.json({ enviados: 0 }, { status: 200 })

  const respSubs = await rest(
    `push_subscriptions?select=endpoint,p256dh,auth&user_id=in.(${destinos.join(",")})`,
  )

  if (!respSubs.ok) {
    // Lo más probable: falta correr la 0036. No es un error del cliente.
    return Response.json({ enviados: 0, nota: "sin tabla de suscripciones" }, { status: 200 })
  }

  const suscripciones = (await respSubs.json().catch(() => [])) as Suscripcion[]
  const { enviados, muertos } = await mandarPush(suscripciones)

  /**
   * Las suscripciones que el servicio dio por muertas se borran aquí y no en el
   * navegador: quien las tenía ya no está para borrarlas, y si se dejan, cada
   * aviso futuro gasta una petición en un teléfono que no existe.
   */
  if (muertos.length > 0) {
    const lista = muertos.map((e) => `"${e}"`).join(",")
    await rest(`push_subscriptions?endpoint=in.(${encodeURIComponent(lista)})`, {
      method: "DELETE",
    }).catch(() => {})
  }

  return Response.json({ enviados, destinos: destinos.length }, { status: 200 })
}
