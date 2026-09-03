// Módulo sin "use client" a propósito: lo consumen tanto la página del catálogo
// (componente de servidor) como el header (componente de cliente). Si viviera en
// un archivo "use client", el servidor recibiría una referencia en vez del array.
// El orden de aquí manda: lo usan las pestañas del catálogo y el carrusel del
// inicio. Se cambia una vez y los dos lados quedan iguales.
export const categories = [
  "Todos",
  "Proteínas",
  "Lácteos",
  "Granos",
  "Harinas",
  "Bebidas",
  "Enlatados",
  "Aceites",
  "Limpieza",
] as const

export type Category = (typeof categories)[number]

export function toCategory(value: string | undefined): Category {
  return categories.includes(value as Category) ? (value as Category) : "Todos"
}
