/**
 * Cuántas unidades trae una presentación al mayor, leído de su texto.
 *
 * "Bulto de 12 · 1 kg c/u" trae 12; "Caja de 24" trae 24; "Unidad · 1 kg" no
 * es al mayor y da null. Sale del texto porque es lo que carga el abasto: no
 * hay un campo aparte, y pedirle que llene dos cosas para lo mismo termina en
 * que no coinciden.
 */
export function unidadesPorPresentacion(unidad: string | null | undefined): number | null {
  const encontrado = (unidad ?? "").match(
    /\b(?:bulto|caja|paquete|pack|fardo|display|bandeja|saco)\s+(?:de\s+)?(\d{1,4})\b/i,
  )
  if (!encontrado) return /\bdocena\b/i.test(unidad ?? "") ? 12 : null

  const cantidad = Number(encontrado[1])
  return cantidad > 1 ? cantidad : null
}

/**
 * El precio de cada unidad de una presentación al mayor, o null si no es al
 * mayor.
 *
 * Es la cuenta que todo el que compra al mayor hace de cabeza para saber si le
 * conviene: un bulto de $24,50 dice poco, "$2,04 c/u" se compara directo con lo
 * que cuesta suelto en la bodega.
 */
export function precioPorUnidad(precio: number, unidad: string | null | undefined): number | null {
  const cantidad = unidadesPorPresentacion(unidad)
  if (!cantidad || !(precio > 0)) return null
  return Math.round((precio / cantidad) * 100) / 100
}
