import { createPrivateKey, createSign } from "node:crypto"

/**
 * Mandar un golpe de push, sin librerías.
 *
 * Existe `web-push` en npm y hace esto mismo, pero en este proyecto `npm
 * install` está roto y agregar una dependencia para firmar un JWT y hacer un
 * POST no vale el riesgo de quedarse trabado. Todo lo que hace falta está en
 * `node:crypto`.
 *
 * QUÉ ES VAPID: el servicio de push del navegador (Google, Apple, Mozilla)
 * necesita saber que el aviso viene de nosotros. Se lo demostramos firmando un
 * JWT con una clave privada que solo nosotros tenemos, y mandando la pública en
 * la misma petición para que pueda comprobar la firma.
 *
 * EL AVISO VA SIN CONTENIDO, a propósito. Mandarlo con texto obliga a cifrarlo
 * con el esquema del navegador (RFC 8291): curva elíptica efímera, derivación
 * de clave, AES-GCM. Es fácil de equivocar y cuando se equivoca no falla con un
 * error: el aviso simplemente no aparece. Aquí el service worker recibe el
 * golpe y le pregunta a la app qué mostrar, que además tiene la ventaja de que
 * el texto sale al día del momento en que se lee y no del momento en que se
 * mandó.
 */

export type Suscripcion = {
  endpoint: string
  p256dh: string
  auth: string
}

/** Push usa base64 sin relleno y con - _ en vez de + / */
function url64(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/**
 * Rearma la clave privada a partir de las dos variables de entorno.
 *
 * La privada se guarda como los 32 bytes crudos del escalar, pero `crypto`
 * quiere una clave completa, así que las coordenadas del punto salen de la
 * pública: son las dos mitades de sus 65 bytes, después del 0x04 que marca que
 * el punto viene sin comprimir.
 */
function clavePrivada(publica: string, privada: string) {
  const punto = Buffer.from(publica, "base64url")

  if (punto.length !== 65 || punto[0] !== 4) {
    throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY no tiene la forma esperada")
  }

  return createPrivateKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "P-256",
      d: privada,
      x: url64(punto.subarray(1, 33)),
      y: url64(punto.subarray(33, 65)),
    },
  })
}

/**
 * El JWT que prueba que el aviso es nuestro.
 *
 * Se firma uno por cada servicio de push -- el `aud` es el origen del endpoint
 * y cambia entre Google, Apple y Mozilla -- pero vale para todos los avisos que
 * se manden a ese servicio, así que se reusa dentro de la misma tanda.
 */
export function firmarVapid(origen: string, publica: string, privada: string, sujeto: string) {
  const cabecera = url64(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })))
  const cuerpo = url64(
    Buffer.from(
      JSON.stringify({
        aud: origen,
        // Doce horas. El máximo que acepta la especificación son 24; con menos
        // margen, un reloj corrido en el servidor haría rechazar todo.
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: sujeto,
      }),
    ),
  )

  const sinFirmar = `${cabecera}.${cuerpo}`
  const firma = createSign("SHA256")
  firma.update(sinFirmar)
  firma.end()

  /**
   * `ieee-p1363` da la firma como los 64 bytes de r y s pegados. Sin esto Node
   * la devuelve en DER, que es lo que espera casi todo lo demás y lo único que
   * el push NO acepta: el aviso se rechazaría con un 400 sin explicación.
   */
  const bytes = firma.sign({
    key: clavePrivada(publica, privada),
    dsaEncoding: "ieee-p1363",
  })

  return `${sinFirmar}.${url64(bytes)}`
}

/** Si están las tres variables. Sin ellas no se puede mandar nada. */
export function hayVapid() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  )
}

export type ResultadoPush = {
  enviados: number
  /** Endpoints que el servicio dio por muertos: hay que borrarlos. */
  muertos: string[]
}

/**
 * Manda el golpe a cada suscripción. No lanza: un teléfono apagado o una
 * suscripción vieja no puede tumbar la operación que disparó el aviso.
 */
export async function mandarPush(suscripciones: Suscripcion[]): Promise<ResultadoPush> {
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privada = process.env.VAPID_PRIVATE_KEY
  const sujeto = process.env.VAPID_SUBJECT

  if (!publica || !privada || !sujeto) return { enviados: 0, muertos: [] }

  const porOrigen = new Map<string, string>()
  const muertos: string[] = []
  let enviados = 0

  await Promise.all(
    suscripciones.map(async (sub) => {
      let origen: string
      try {
        origen = new URL(sub.endpoint).origin
      } catch {
        muertos.push(sub.endpoint)
        return
      }

      try {
        let jwt = porOrigen.get(origen)
        if (!jwt) {
          jwt = firmarVapid(origen, publica, privada, sujeto)
          porOrigen.set(origen, jwt)
        }

        const respuesta = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            Authorization: `vapid t=${jwt}, k=${publica}`,
            // Cuánto lo guarda el servicio si el teléfono está sin señal. Una
            // hora: más tarde que eso, el pedido ya lo atendió alguien.
            TTL: "3600",
            Urgency: "high",
            "Content-Length": "0",
          },
        })

        // 404 y 410 son la forma en que el servicio dice que esa suscripción ya
        // no existe: se desinstaló la app, se limpiaron los datos del sitio.
        if (respuesta.status === 404 || respuesta.status === 410) {
          muertos.push(sub.endpoint)
          return
        }

        if (respuesta.ok) enviados += 1
      } catch {
        // Sin red hacia el servicio de push. El aviso en pantalla sigue.
      }
    }),
  )

  return { enviados, muertos }
}
