/**
 * Saca el monto y la referencia del texto de un aviso del banco.
 *
 * Cada banco escribe el suyo distinto y ninguno publica el formato, así que
 * esto no intenta entender la oración: busca las dos cosas que siempre están,
 * un monto en bolívares y un número de referencia, y se rinde con claridad
 * cuando no las encuentra. Rendirse es correcto: mejor no registrar un pago
 * que registrar uno con el monto equivocado.
 */

export type AvisoBanco = {
  referencia: string | null
  monto: number | null
}

/**
 * "1.234,56" -> 1234.56
 *
 * Aquí se escribe con punto de miles y coma decimal, pero los avisos no son
 * consistentes: algunos mandan "1234.56" y otros "1234,56". Se decide por la
 * forma del número, no por suponer.
 */
export function leerMonto(texto: string): number | null {
  const limpio = texto.trim().replace(/\s/g, "")
  if (!/^\d[\d.,]*$/.test(limpio)) return null

  const tieneComa = limpio.includes(",")
  const tienePunto = limpio.includes(".")

  let normalizado: string

  if (tieneComa && tienePunto) {
    // El último separador que aparece es el decimal.
    const ultimaComa = limpio.lastIndexOf(",")
    const ultimoPunto = limpio.lastIndexOf(".")
    normalizado =
      ultimaComa > ultimoPunto
        ? limpio.replace(/\./g, "").replace(",", ".")
        : limpio.replace(/,/g, "")
  } else if (tieneComa) {
    // Una coma con tres dígitos detrás son miles: "1,234" es mil doscientos.
    const detras = limpio.length - limpio.lastIndexOf(",") - 1
    normalizado = detras === 3 ? limpio.replace(/,/g, "") : limpio.replace(",", ".")
  } else if (tienePunto) {
    const detras = limpio.length - limpio.lastIndexOf(".") - 1
    // Lo mismo al revés, y también si hay varios puntos: son separadores.
    normalizado = detras === 3 || (limpio.match(/\./g) ?? []).length > 1
      ? limpio.replace(/\./g, "")
      : limpio
  } else {
    normalizado = limpio
  }

  const valor = Number(normalizado)
  return Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) / 100 : null
}

/** Los teléfonos aparecen enmascarados y no son referencias. */
const ENMASCARADO = /\*/

export function leerAvisoBanco(texto: string): AvisoBanco {
  const plano = (texto ?? "").replace(/\s+/g, " ").trim()
  if (!plano) return { referencia: null, monto: null }

  // ------------------------------------------------------------- el monto
  //
  // Se busca pegado a "Bs", que es lo único que todos los avisos comparten.
  // Sin ese ancla, cualquier número del mensaje podría pasar por monto.
  let monto: number | null = null

  const conBsDelante = plano.match(/(?:bs|bol[ií]var(?:es)?)\.?\s*:?\s*([\d.,]+)/i)
  const conBsDetras = plano.match(/([\d.,]+)\s*(?:bs|bol[ií]var(?:es)?)\b/i)

  for (const encontrado of [conBsDelante, conBsDetras]) {
    if (!encontrado) continue
    const valor = leerMonto(encontrado[1])
    if (valor !== null) {
      monto = valor
      break
    }
  }

  // -------------------------------------------------------- la referencia
  //
  // Primero por la palabra: es lo confiable. Solo si no aparece se recurre a
  // buscar el número más largo, que es adivinar y por eso va al final.
  let referencia: string | null = null

  const conPalabra = plano.match(
    /(?:ref(?:erencia)?|nro|n[úu]m(?:ero)?|operaci[óo]n|comprobante)\.?\s*:?\s*(\d{4,})/i,
  )

  if (conPalabra) {
    referencia = conPalabra[1]
  } else {
    const candidatos = [...plano.matchAll(/\d{6,}/g)]
      .map((m) => m[0])
      // Un número pegado a un asterisco es un teléfono tapado, no una
      // referencia. Y el monto ya se descartó porque lleva coma o punto.
      .filter((n) => !ENMASCARADO.test(plano.slice(Math.max(0, plano.indexOf(n) - 2), plano.indexOf(n) + n.length + 2)))
      .sort((a, b) => b.length - a.length)

    referencia = candidatos[0] ?? null
  }

  return { referencia, monto }
}
