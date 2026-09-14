import { createClient } from "@/lib/supabase/server"
import { hayVapid, mandarPush, type Suscripcion } from "@/lib/push-servidor"

/**
 * Despierta el teléfono de quien tiene que hacer algo.
 *
 * Los avisos que ya existían solo suenan con la pantalla abierta: son el propio
 * navegador reaccionando a un cambio. Esto es lo otro, lo que llega con la app
 * cerrada y el teléfono en el bolsillo.
 *
 * Los momentos donde la cadena se detiene esperando a una persona, más el que
 * espera el cliente:
 *
 *   pago-reportado  el cliente dice que pagó -> se despierta a admin y dev,
 *                   porque hasta que uno confirme, el pedido no sale.
 *   pedido-listo    el pago quedó confirmado -> se despierta a los shoppers,
 *                   que recién ahora pueden tomarlo.
 *   pedido-nuevo    entró un pedido que no espera pago (efectivo contra
 *                   entrega) -> se despierta a los shoppers. Sin este, esos
 *                   pedidos salían disponibles en silencio: el cliente no
 *                   podía pedir `pedido-listo`, que es solo de admin y dev.
 *   estado-cliente  un pedido avanzó (pago confirmado, comprando, en camino,
 *                   entregado) -> se despierta a su dueño, y solo a él. Antes
 *                   al cliente no le llegaba nada con la app cerrada: tenía
 *                   que acordarse de abrirla para saber si ya venía.
 *
 * QUIÉN PUEDE DISPARAR CADA UNO no sale del cuerpo de la petición sino de lo
 * que la persona realmente tiene: para el primero hay que tener un pedido
 * propio con pago reportado y sin verificar; para el segundo, ser admin o dev;
 * para el tercero, un pedido propio de los últimos minutos, sin shopper y que
 * no espera pago; para el cuarto, ser el shopper de ese pedido, o admin o dev.
 * Si dependiera de lo que dice el cuerpo, cualquiera con sesión podría hacer
 * sonar los teléfonos de otros cuando quisiera.
 *
 * El golpe va sin contenido y el service worker pregunta qué mostrar: ver
 * `lib/push-servidor.ts` y `/api/aviso-pendiente`.
 */

// Node y no Edge: la firma del JWT usa node:crypto.
export const runtime = "nodejs"

type Motivo = "pago-reportado" | "pedido-listo" | "pedido-nuevo" | "estado-cliente"

const MOTIVOS: readonly Motivo[] = ["pago-reportado", "pedido-listo", "pedido-nuevo", "estado-cliente"]

const ROLES_DESTINO: Record<Exclude<Motivo, "estado-cliente">, string[]> = {
  "pago-reportado": ["admin", "dev"],
  // admin y dev también toman pedidos, así que también les llega.
  "pedido-listo": ["shopper", "admin", "dev"],
  "pedido-nuevo": ["shopper", "admin", "dev"],
}

/**
 * Cuándo se avisó por última vez de cada motivo.
 *
 * Sin esto, una pantalla con un error de reintento haría vibrar todos los
 * teléfonos del equipo cada pocos segundos. Vive en memoria del proceso, así
 * que no es una garantía: es lo suficiente para que un accidente no se vuelva
 * un castigo, y lo barato para no meter otra tabla en el medio.
 *
 * Los del cliente van por pedido y con menos espera: un shopper puede pasar de
 * "comprando" a "en camino" en pocos minutos, y cada paso es noticia.
 */
const ultimoAviso = new Map<string, number>()
const ESPERA_MS = 45_000
const ESPERA_CLIENTE_MS = 15_000

/** Un uuid y nada más: va dentro de una ruta de PostgREST. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  let pedido: string | null = null
  try {
    const cuerpo = (await request.json()) as { motivo?: string; pedido?: string }
    if (!MOTIVOS.includes(cuerpo.motivo as Motivo)) {
      return Response.json({ error: "Motivo desconocido" }, { status: 400 })
    }
    motivo = cuerpo.motivo as Motivo
    if (motivo === "estado-cliente") {
      if (!cuerpo.pedido || !UUID.test(cuerpo.pedido)) {
        return Response.json({ error: "Falta el pedido" }, { status: 400 })
      }
      pedido = cuerpo.pedido
    }
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
  } else if (motivo === "pedido-nuevo") {
    // Un pedido propio recién hecho, que ya está a la vista de los shoppers:
    // sin shopper, confirmado y sin pago que esperar. Los que esperan pago
    // avisan después, cuando alguien lo confirma.
    const haceUnRato = new Date(Date.now() - 10 * 60_000).toISOString()
    const { data } = await supabase
      .from("orders")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "confirmado")
      .is("shopper_id", null)
      .eq("payment_required", false)
      .gte("created_at", haceUnRato)
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

    const esEquipo = !!perfil && ["admin", "dev"].includes(perfil.role)

    if (motivo === "pedido-listo" && !esEquipo) {
      return Response.json({ error: "No tienes permiso" }, { status: 403 })
    }

    if (motivo === "estado-cliente" && !esEquipo) {
      // El shopper, solo por el pedido que lleva él.
      const { data } = await supabase
        .from("orders")
        .select("id")
        .eq("id", pedido!)
        .eq("shopper_id", user.id)
        .limit(1)

      if (!data?.length) {
        return Response.json({ error: "No tienes permiso" }, { status: 403 })
      }
    }
  }

  const clave = pedido ? `${motivo}:${pedido}` : motivo
  const espera = motivo === "estado-cliente" ? ESPERA_CLIENTE_MS : ESPERA_MS
  const desde = ultimoAviso.get(clave) ?? 0
  if (Date.now() - desde < espera) {
    return Response.json({ enviados: 0, nota: "se avisó hace poco" }, { status: 200 })
  }
  ultimoAviso.set(clave, Date.now())

  // ------------------------------------------------------- a quién despertar

  let destinos: string[]

  if (motivo === "estado-cliente") {
    // Con la llave de servicio: el dueño del pedido no es quien llama, y un
    // shopper no tiene por qué poder leer de quién es.
    const resp = await rest(`orders?select=user_id&id=eq.${pedido}`)
    const filas = (await resp.json().catch(() => [])) as { user_id: string }[]
    destinos = Array.isArray(filas) && filas[0]?.user_id ? [filas[0].user_id] : []
  } else {
    const roles = ROLES_DESTINO[motivo].join(",")
    const respPerfiles = await rest(`profiles?select=id&role=in.(${roles})`)
    const perfiles = (await respPerfiles.json().catch(() => [])) as { id: string }[]
    destinos = Array.isArray(perfiles) ? perfiles.map((p) => p.id) : []
  }

  // A quien disparó el aviso no se le avisa: ya está mirando la pantalla.
  destinos = destinos.filter((id) => id !== user.id)

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
