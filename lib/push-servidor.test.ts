import { createVerify, generateKeyPairSync } from "node:crypto"
import { describe, expect, it } from "vitest"

import { firmarVapid } from "./push-servidor"

/**
 * La firma del aviso es lo más fácil de equivocar y lo más difícil de notar:
 * si sale mal, el servicio de push responde un 400 seco desde un servidor de
 * Google al que no tenemos acceso, y desde aquí solo se ve que el teléfono no
 * suena. Nadie lo relacionaría con la firma.
 *
 * Así que se comprueba lo mismo que comprueba el servicio, con el mismo par de
 * claves que genera `scripts/generar-vapid.mjs`: que la firma valide, y que sean
 * los 64 bytes crudos y no los DER que Node da por defecto.
 */

/** Igual que scripts/generar-vapid.mjs: el mismo formato que va a Vercel. */
function parDeClaves() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" })

  const url64 = (buf: Buffer) =>
    buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

  const jwk = publicKey.export({ format: "jwk" }) as { x: string; y: string }

  return {
    objeto: publicKey,
    publica: url64(
      Buffer.concat([
        Buffer.from([4]),
        Buffer.from(jwk.x, "base64url"),
        Buffer.from(jwk.y, "base64url"),
      ]),
    ),
    privada: url64(
      Buffer.from((privateKey.export({ format: "jwk" }) as { d: string }).d, "base64url"),
    ),
  }
}

describe("firmarVapid", () => {
  const { objeto, publica, privada } = parDeClaves()
  const jwt = firmarVapid("https://fcm.googleapis.com", publica, privada, "mailto:a@b.com")

  it("arma un JWT de tres partes", () => {
    expect(jwt.split(".")).toHaveLength(3)
  })

  it("dice quién es el destinatario y quién firma", () => {
    const [cabecera, cuerpo] = jwt.split(".")

    expect(JSON.parse(Buffer.from(cabecera, "base64url").toString())).toEqual({
      typ: "JWT",
      alg: "ES256",
    })

    const datos = JSON.parse(Buffer.from(cuerpo, "base64url").toString())
    expect(datos.aud).toBe("https://fcm.googleapis.com")
    expect(datos.sub).toBe("mailto:a@b.com")
    // Vence en el futuro y dentro de las 24 horas que permite la especificación.
    const ahora = Math.floor(Date.now() / 1000)
    expect(datos.exp).toBeGreaterThan(ahora)
    expect(datos.exp).toBeLessThanOrEqual(ahora + 24 * 60 * 60)
  })

  it("firma con los 64 bytes crudos, no en DER", () => {
    // Una firma DER empieza con 0x30 y mide entre 70 y 72 bytes. El push la
    // rechaza: tienen que ser exactamente 64, r y s pegados.
    expect(Buffer.from(jwt.split(".")[2], "base64url")).toHaveLength(64)
  })

  it("la firma valida con la clave pública", () => {
    const [cabecera, cuerpo, firma] = jwt.split(".")
    const verificador = createVerify("SHA256")
    verificador.update(`${cabecera}.${cuerpo}`)
    verificador.end()

    expect(
      verificador.verify(
        { key: objeto, dsaEncoding: "ieee-p1363" },
        Buffer.from(firma, "base64url"),
      ),
    ).toBe(true)
  })

  it("no firma con una clave pública que no tiene la forma esperada", () => {
    expect(() => firmarVapid("https://x.com", "aGVsbG8", privada, "mailto:a@b.com")).toThrow()
  })
})
