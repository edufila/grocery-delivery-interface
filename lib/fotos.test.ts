import { describe, expect, it } from "vitest"

import { fotoLigera } from "./fotos"

describe("fotoLigera", () => {
  it("cambia a WebP las fotos del repo que lo tienen", () => {
    expect(fotoLigera("/images/store-girasol.png")).toBe("/images/store-girasol.webp")
    expect(fotoLigera("/products/cafe.png")).toBe("/products/cafe.webp")
  })

  it("deja igual lo que no tiene WebP: fotos nuevas, del panel o vacías", () => {
    expect(fotoLigera("/products/nuevo.png")).toBe("/products/nuevo.png")
    expect(fotoLigera("https://x.supabase.co/storage/v1/object/public/fotos/a.webp")).toBe(
      "https://x.supabase.co/storage/v1/object/public/fotos/a.webp",
    )
    expect(fotoLigera(null)).toBeNull()
  })
})
