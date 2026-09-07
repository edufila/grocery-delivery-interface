#!/usr/bin/env node
/**
 * Genera el par de claves para las notificaciones push.
 *
 *   node scripts/generar-vapid.mjs
 *
 * VAPID es como el servicio de push sabe que el aviso viene de nosotros y no de
 * cualquiera. Son dos claves de curva elíptica P-256:
 *
 *   la pública   va en el código y en el navegador de cada persona
 *   la privada   va SOLO en las variables de servidor de Vercel
 *
 * Lo corre una persona y no yo, a propósito: así la clave privada nunca pasa
 * por una conversación. Si alguna vez se filtra, se generan otras y las
 * suscripciones viejas dejan de servir -- molesto, pero no grave.
 */
import { generateKeyPairSync } from "node:crypto"

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" })

/** Push usa base64 sin relleno y con - _ en vez de + / */
const url64 = (buf) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

// La pública viaja como los 65 bytes crudos del punto: 0x04 seguido de X e Y.
//
// Se exporta directo y no con `createPublicKey(publicKey)`: eso último parece lo
// natural pero lanza, porque cuando recibe un objeto de clave Node exige que sea
// la privada. Aquí ya tenemos la pública, así que no hay nada que derivar.
const jwk = publicKey.export({ format: "jwk" })
const publica = url64(
  Buffer.concat([
    Buffer.from([4]),
    Buffer.from(jwk.x, "base64url"),
    Buffer.from(jwk.y, "base64url"),
  ]),
)

const privada = url64(Buffer.from(privateKey.export({ format: "jwk" }).d, "base64url"))

/**
 * Se imprime el nombre y el valor por separado en cada renglón.
 *
 * La versión anterior los ponía uno debajo del otro sin decir cuál era cuál, y
 * al lado del tercero dejaba `mailto:tu@correo.com` como ejemplo. Eso se presta
 * a copiar el ejemplo creyendo que es el valor, y a confundir el aviso de "esta
 * no lleva NEXT_PUBLIC_" con parte del nombre.
 *
 * Vale la pena la verborrea: equivocarse aquí en un sentido no hace nada, y en
 * el otro publica una clave secreta.
 */
console.log("\nTres variables para Vercel (Settings -> Environment Variables).")
console.log("Copia el nombre y el valor por separado, uno por uno.\n")

console.log("  1) Nombre:  NEXT_PUBLIC_VAPID_PUBLIC_KEY")
console.log("     Valor:   " + publica + "\n")

console.log("  2) Nombre:  VAPID_PRIVATE_KEY")
console.log("     Valor:   " + privada)
console.log("     Ojo:     va SIN NEXT_PUBLIC_ adelante. Con ese prefijo viajaría")
console.log("              al navegador de todo el mundo. Y no la pegues en un chat.\n")

console.log("  3) Nombre:  VAPID_SUBJECT")
console.log("     Valor:   mailto: seguido de TU correo -- no copies un ejemplo.")
console.log("              Es a donde el servicio de push avisa si algo va mal.\n")

console.log("Falta una cuarta, que quizá ya esté cargada: SUPABASE_SERVICE_ROLE_KEY.")
console.log("Sin ella los avisos no salen, porque no se pueden buscar los teléfonos")
console.log("de admin y dev. Esa sale del panel de Supabase.\n")

console.log("Después de agregarlas hay que volver a desplegar: las variables no")
console.log("entran en un despliegue que ya se hizo.\n")
