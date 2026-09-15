import { normalizarTexto } from "./texto"

type Comparable = { id: string; name: string; unit: string; price: number; store_id: string }

/**
 * Qué renglones son "el más barato" de un producto que está en varios abastos.
 *
 * Es la razón de tener varios abastos en una misma app: el mismo arroz cuesta
 * distinto en cada uno. Se considera el mismo producto si coinciden nombre y
 * presentación, sin acentos ni mayúsculas. Solo cuenta si está en al menos dos
 * abastos distintos, y si hay empate en el precio más bajo no se marca ninguno:
 * no hay nada que elegir.
 *
 * Devuelve claves "abasto-producto".
 */
export function masBaratos(filas: Comparable[]): Set<string> {
  const porProducto = new Map<string, Comparable[]>()
  for (const fila of filas) {
    const clave = normalizarTexto(`${fila.name} ${fila.unit}`)
    porProducto.set(clave, [...(porProducto.get(clave) ?? []), fila])
  }

  const ganadores = new Set<string>()
  for (const grupo of porProducto.values()) {
    if (new Set(grupo.map((f) => f.store_id)).size < 2) continue
    const minimo = Math.min(...grupo.map((f) => Number(f.price)))
    const conMinimo = grupo.filter((f) => Number(f.price) === minimo)
    if (conMinimo.length === 1) ganadores.add(`${conMinimo[0].store_id}-${conMinimo[0].id}`)
  }
  return ganadores
}
