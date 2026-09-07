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
import { generateKeyPairSync, createPublicKey } from "node:crypto"

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" })

/** Push usa base64 sin relleno y con - _ en vez de + / */
const url64 = (buf) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

// La pública viaja como los 65 bytes crudos del punto: 0x04 seguido de X e Y.
const jwk = createPublicKey(publicKey).export({ format: "jwk" })
const publica = url64(
  Buffer.concat([
    Buffer.from([4]),
    Buffer.from(jwk.x, "base64url"),
    Buffer.from(jwk.y, "base64url"),
  ]),
)

const privada = url64(Buffer.from(privateKey.export({ format: "jwk" }).d, "base64url"))

console.log("\nTres variables para Vercel (Settings -> Environment Variables):\n")
console.log("  NEXT_PUBLIC_VAPID_PUBLIC_KEY")
console.log("  " + publica + "\n")
console.log("  VAPID_PRIVATE_KEY   <-- esta NO lleva NEXT_PUBLIC_, es secreta")
console.log("  " + privada + "\n")
console.log("  VAPID_SUBJECT       <-- tu correo, para que el servicio de push")
console.log("  mailto:tu@correo.com    sepa a quién avisarle si algo va mal\n")
console.log("Después de agregarlas hay que volver a desplegar.\n")
