"use client"

import { useEffect, useState } from "react"
import { History } from "lucide-react"

import { RepetirPedido } from "@/components/tracking/repetir-pedido"
import { formatOrderDate } from "@/lib/orders"
import { usuarioEnTelefono } from "@/lib/sesion"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

type Compra = {
  code: string
  created_at: string
  store_id: string | null
  tienda: string | null
  renglones: { product_id: string; qty: number; name: string }[]
}

/**
 * "Tu última compra", con el botón de volver a pedirla, arriba del inicio.
 *
 * En un abasto la compra se repite casi igual todas las semanas. El botón de
 * repetir ya existía, pero escondido al final del seguimiento de un pedido
 * viejo: había que ir a Pedidos, abrir el de la semana pasada y bajar hasta el
 * fondo. Aquí está en la primera pantalla, que es donde uno decide qué comprar.
 *
 * No sale si hay un pedido en curso: ahí lo que importa es seguirlo, y ese
 * aviso ya ocupa este lugar.
 */
export function UltimaCompra() {
  const [compra, setCompra] = useState<Compra | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelado = false

    void (async () => {
      const supabase = createClient()
      const usuario = await usuarioEnTelefono(supabase)
      if (!usuario || cancelado) return

      // Filtrado por usuario aunque haya RLS: a admin y dev la política les deja
      // ver los pedidos de todos.
      const [{ count: enCurso }, { data: ultimos }] = await Promise.all([
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("user_id", usuario.id)
          .in("status", ["confirmado", "preparando", "en_camino"]),
        supabase
          .from("orders")
          .select("id, code, created_at, store_id")
          .eq("user_id", usuario.id)
          .eq("status", "entregado")
          .order("created_at", { ascending: false })
          .limit(1)
          .returns<{ id: string; code: string; created_at: string; store_id: string | null }[]>(),
      ])

      const ultimo = ultimos?.[0]
      if (cancelado || (enCurso ?? 0) > 0 || !ultimo) return

      const [{ data: renglones }, { data: tienda }] = await Promise.all([
        supabase
          .from("order_items")
          .select("product_id, qty, name")
          .eq("order_id", ultimo.id)
          .returns<{ product_id: string; qty: number; name: string }[]>(),
        supabase
          .from("stores")
          .select("name")
          .eq("id", ultimo.store_id ?? "girasol")
          .maybeSingle<{ name: string }>(),
      ])

      if (cancelado || !renglones?.length) return
      setCompra({ ...ultimo, tienda: tienda?.name ?? null, renglones })
    })()

    return () => {
      cancelado = true
    }
  }, [])

  if (!compra) return null

  const nombres = compra.renglones.map((r) => r.name)
  const resumen =
    nombres.length <= 3
      ? nombres.join(", ")
      : `${nombres.slice(0, 3).join(", ")} y ${nombres.length - 3} más`

  return (
    <section className="mx-auto max-w-md px-4 pt-4">
      <div className="animate-[entra_0.35s_ease-out] rounded-2xl border border-gray-100 bg-white p-4 shadow-sm shadow-gray-900/[0.06]">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50">
            <History className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">
              Tu última compra{compra.tienda ? ` en ${compra.tienda}` : ""}
            </p>
            <p className="line-clamp-2 text-sm leading-relaxed text-gray-500">{resumen}</p>
            <p className="mt-0.5 text-xs text-gray-500">{formatOrderDate(compra.created_at)}</p>
          </div>
        </div>
        <div className="mt-3">
          <RepetirPedido
            items={compra.renglones.map((r) => ({ product_id: r.product_id, qty: r.qty }))}
          />
        </div>
      </div>
    </section>
  )
}
