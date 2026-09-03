/**
 * "Harina de Maíz PAN" -> "harina-de-maiz-pan"
 *
 * Es el identificador de un producto, así que tiene que ser estable y sin
 * acentos: viaja en URLs y se compara contra lo que ya está en la base.
 */
export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}
