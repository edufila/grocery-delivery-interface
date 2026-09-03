// Módulo sin "use client" a propósito: lo consumen tanto la página del catálogo
// (componente de servidor) como el header (componente de cliente). Si viviera en
// un archivo "use client", el servidor recibiría una referencia en vez del array.
export const categories = [
  "Todos",
  "Granos",
  "Aceites",
  "Harinas",
  "Proteínas",
  "Bebidas",
  "Lácteos",
  "Limpieza",
  "Enlatados",
] as const

export type Category = (typeof categories)[number]

export function toCategory(value: string | undefined): Category {
  return categories.includes(value as Category) ? (value as Category) : "Todos"
}
