import { describe, expect, it } from "vitest"

import { toCategory } from "./categories"
import { formatMoney, nextStatus, statusLabel, type OrderStatus } from "./orders"
import { formatBirthDate, isProfileComplete } from "./profile"
import { safeNextPath } from "./safe-path"
import { slugify } from "./slug"

describe("safeNextPath", () => {
  it("deja pasar rutas internas", () => {
    expect(safeNextPath("/checkout")).toBe("/checkout")
    expect(safeNextPath("/pedidos/GA-4822")).toBe("/pedidos/GA-4822")
  })

  it("rechaza destinos fuera del sitio", () => {
    // Las dos primeras son protocol-relative: el navegador las manda a otro dominio.
    expect(safeNextPath("//evil.com")).toBe("/")
    expect(safeNextPath("/\\evil.com")).toBe("/")
    expect(safeNextPath("https://evil.com")).toBe("/")
    expect(safeNextPath("evil.com")).toBe("/")
  })

  it("cae al respaldo cuando no hay nada", () => {
    expect(safeNextPath(undefined)).toBe("/")
    expect(safeNextPath("")).toBe("/")
    expect(safeNextPath(null, "/perfil")).toBe("/perfil")
  })
})

describe("estados del pedido", () => {
  it("avanza en orden y se detiene al entregar", () => {
    expect(nextStatus("confirmado")).toBe("preparando")
    expect(nextStatus("preparando")).toBe("en_camino")
    expect(nextStatus("en_camino")).toBe("entregado")
    expect(nextStatus("entregado")).toBeNull()
  })

  it("no ofrece salida desde cancelado", () => {
    expect(nextStatus("cancelado")).toBeNull()
  })

  it("dice que busca shopper mientras nadie lo tomó", () => {
    expect(statusLabel("confirmado", null)).toBe("Buscando shopper")
    expect(statusLabel("confirmado", "un-uuid")).toBe("Shopper asignado")
  })

  it("los demás estados no dependen del shopper", () => {
    const estados: OrderStatus[] = ["preparando", "en_camino", "entregado"]
    for (const estado of estados) {
      expect(statusLabel(estado, null)).toBe(statusLabel(estado, "un-uuid"))
    }
  })
})

describe("formatos", () => {
  it("muestra siempre dos decimales", () => {
    expect(formatMoney(1.5)).toBe("$1.50")
    expect(formatMoney(0)).toBe("$0.00")
    // numeric de Postgres llega como texto por el driver.
    expect(formatMoney("22.1" as unknown as number)).toBe("$22.10")
  })

  it("pone el día primero, sin pasar por Date", () => {
    expect(formatBirthDate("1990-04-23")).toBe("23/04/1990")
    expect(formatBirthDate(null)).toBeNull()
  })
})

describe("perfil completo", () => {
  it("exige nombre y teléfono", () => {
    const base = { id: "1", birth_date: null, created_at: "", updated_at: "" }
    expect(isProfileComplete({ ...base, full_name: "Ana", phone: "04141234567" })).toBe(true)
    expect(isProfileComplete({ ...base, full_name: "Ana", phone: null })).toBe(false)
    expect(isProfileComplete({ ...base, full_name: null, phone: "04141234567" })).toBe(false)
    expect(isProfileComplete(null)).toBe(false)
  })
})

describe("categorías", () => {
  it("acepta las que existen", () => {
    expect(toCategory("Granos")).toBe("Granos")
    expect(toCategory("Proteínas")).toBe("Proteínas")
  })

  it("cae en Todos ante cualquier otra cosa", () => {
    expect(toCategory("Inventada")).toBe("Todos")
    expect(toCategory(undefined)).toBe("Todos")
  })
})

describe("slugify", () => {
  it("saca acentos y espacios", () => {
    expect(slugify("Harina de Maíz PAN")).toBe("harina-de-maiz-pan")
    expect(slugify("Café  Molido")).toBe("cafe-molido")
  })

  it("no deja guiones colgando en los bordes", () => {
    expect(slugify("  Azúcar!  ")).toBe("azucar")
    expect(slugify("¿Qué?")).toBe("que")
  })
})
