"use client"

import { useEffect, useState } from "react"
import { BadgeCheck, Loader2, Phone, X } from "lucide-react"

import {
  formatMoney,
  formatOrderDate,
  ITEM_STATUS_LABEL,
  PAYMENT_LABEL,
  statusLabel,
  type Order,
  type OrderItem,
} from "@/lib/orders"
import { createClient } from "@/lib/supabase/client"

type Persona = { id: string; full_name: string | null; phone: string | null; email: string | null }

/**
 * Todo lo que se sabe de un pedido, para cuando el cliente llama preguntando.
 *
 * Se carga al abrirlo y no con la lista: son cien pedidos en pantalla y traer
 * los renglones de todos para mostrar uno sería pedirle a la base cien veces
 * lo que no se va a mirar.
 */
export function DetallePedido({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [orden, setOrden] = useState<Order | null>(null)
  const [renglones, setRenglones] = useState<OrderItem[]>([])
  const [cliente, setCliente] = useState<Persona | null>(null)
  const [shopper, setShopper] = useState<Persona | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")
  const [verificando, setVerificando] = useState(false)

  async function verificar() {
    setVerificando(true)
    const { error: rpcError } = await createClient().rpc("verify_payment", {
      p_order_id: orderId,
      p_ok: true,
    })
    setVerificando(false)

    if (rpcError) {
      setError(
        rpcError.message.includes("does not exist")
          ? "Falta correr la migración de pagos en Supabase."
          : rpcError.message,
      )
      return
    }
    setOrden((previa) =>
      previa ? { ...previa, payment_verified_at: new Date().toISOString() } : previa,
    )
  }

  useEffect(() => {
    let cancelado = false

    void (async () => {
      const supabase = createClient()

      const [{ data: fila, error: errorOrden }, { data: items }] = await Promise.all([
        supabase.from("orders").select("*").eq("id", orderId).maybeSingle<Order>(),
        supabase
          .from("order_items")
          .select("id, product_id, name, unit, unit_price, qty, status, final_qty")
          .eq("order_id", orderId)
          .order("name")
          .returns<OrderItem[]>(),
      ])

      if (cancelado) return

      if (errorOrden || !fila) {
        setError("No pudimos cargar el pedido.")
        setCargando(false)
        return
      }

      setOrden(fila)
      setRenglones(items ?? [])

      // Los renglones pueden venir vacíos si falta correr la migración que deja
      // al admin verlos: se avisa en vez de mostrar un pedido sin nada.
      if ((items ?? []).length === 0) {
        setError("Sin renglones. Si el pedido tenía productos, falta correr la migración 0026.")
      }

      const ids = [fila.user_id, fila.shopper_id].filter(Boolean) as string[]
      if (ids.length > 0) {
        const { data: personas } = await supabase
          .from("profiles")
          .select("id, full_name, phone, email")
          .in("id", ids)
          .returns<Persona[]>()

        if (!cancelado) {
          setCliente((personas ?? []).find((p) => p.id === fila.user_id) ?? null)
          setShopper((personas ?? []).find((p) => p.id === fila.shopper_id) ?? null)
        }
      }

      if (!cancelado) setCargando(false)
    })()

    return () => {
      cancelado = true
    }
  }, [orderId])

  // Con la hoja abierta el fondo no debe scrollear.
  useEffect(() => {
    const antes = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", alTeclado)
    return () => {
      document.body.style.overflow = antes
      window.removeEventListener("keydown", alTeclado)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Cerrar"
      />

      <div className="relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white">
        <header className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-sm font-semibold text-gray-900">
              {orden?.code ?? "Pedido"}
            </p>
            {orden && (
              <p className="truncate text-xs text-gray-500">
                {statusLabel(orden.status, orden.shopper_id)} ·{" "}
                {formatOrderDate(orden.created_at)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {cargando ? (
            <p className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Cargando...
            </p>
          ) : !orden ? (
            <p className="py-12 text-center text-sm text-rose-600">{error}</p>
          ) : (
            <div className="flex flex-col gap-5">
              <Bloque titulo="Cliente">
                <p className="text-sm font-medium text-gray-900">
                  {cliente?.full_name || cliente?.email || "Sin nombre cargado"}
                </p>
                {cliente?.phone && (
                  <a
                    href={`tel:${cliente.phone.replace(/\s/g, "")}`}
                    className="mt-1 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-emerald-600"
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    {cliente.phone}
                  </a>
                )}
              </Bloque>

              <Bloque titulo="Entrega">
                <p className="text-sm font-medium text-gray-900">{orden.address_label}</p>
                <p className="text-sm text-gray-500">{orden.address_detail}</p>
                {orden.customer_note && (
                  <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-900">
                    {orden.customer_note}
                  </p>
                )}
                {orden.address_lat == null && (
                  <p className="mt-2 text-xs text-amber-700">Sin punto en el mapa.</p>
                )}
              </Bloque>

              <Bloque titulo="Shopper">
                <p className="text-sm text-gray-900">
                  {orden.shopper_id
                    ? shopper?.full_name || shopper?.email || "Asignado, sin nombre cargado"
                    : "Todavía nadie lo tomó"}
                </p>
                {orden.cancel_reason && (
                  <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm leading-relaxed text-rose-800">
                    Cancelado: {orden.cancel_reason}
                  </p>
                )}
              </Bloque>

              <Bloque titulo={`Productos (${renglones.length})`}>
                {error && renglones.length === 0 ? (
                  <p className="text-sm leading-relaxed text-amber-700">{error}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {renglones.map((item) => {
                      const llevadas = item.final_qty ?? item.qty
                      const cambio = llevadas !== item.qty
                      return (
                        <li key={item.id} className="flex items-start gap-3">
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm text-gray-900">{item.name}</span>
                            <span className="block text-xs text-gray-500">
                              {item.unit} · {formatMoney(item.unit_price)} c/u
                              {item.status !== "pendiente" &&
                                ` · ${ITEM_STATUS_LABEL[item.status] ?? item.status}`}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm tabular-nums text-gray-600">
                            {cambio ? (
                              <>
                                <span className="text-gray-400 line-through">{item.qty}</span>{" "}
                                <span className="font-semibold text-gray-900">{llevadas}</span>
                              </>
                            ) : (
                              `x${item.qty}`
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Bloque>

              <Bloque titulo="Cuenta">
                <dl className="flex flex-col gap-1.5 text-sm">
                  <Renglon label="Subtotal" valor={formatMoney(orden.subtotal)} />
                  <Renglon label="Servicio" valor={formatMoney(orden.service_fee)} />
                  <Renglon label="Delivery" valor={formatMoney(orden.delivery_fee)} />
                  <div className="mt-1 flex justify-between border-t border-gray-100 pt-2 text-base font-semibold text-gray-900">
                    <dt>Total</dt>
                    <dd className="tabular-nums">
                      {formatMoney(orden.final_total ?? orden.total)}
                    </dd>
                  </div>
                  {orden.final_total != null && orden.final_total !== orden.total && (
                    <p className="text-xs text-gray-500">
                      Estimado al pedir: {formatMoney(orden.total)}. Cambió por lo que el shopper
                      encontró en el abasto.
                    </p>
                  )}
                  <Renglon
                    label="Pago"
                    valor={PAYMENT_LABEL[orden.payment_method] ?? orden.payment_method}
                  />
                </dl>

                {/* Lo que el cliente dice que transfirió. Verificarlo es mirar
                    el banco: la app no tiene forma de saberlo sola. */}
                {orden.payment_reference ? (
                  <div className="mt-3 rounded-xl border border-gray-200 p-3">
                    <p className="text-sm text-gray-900">
                      Referencia reportada:{" "}
                      <span className="font-mono font-semibold">{orden.payment_reference}</span>
                    </p>
                    {orden.payment_verified_at ? (
                      <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                        <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                        Verificada
                      </p>
                    ) : (
                      <>
                        <p className="mt-1 text-xs leading-relaxed text-gray-500">
                          Búscala en tu banco antes de confirmar. Esto no comprueba nada solo.
                        </p>
                        <button
                          type="button"
                          onClick={() => void verificar()}
                          disabled={verificando}
                          className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:bg-gray-200 disabled:text-gray-400"
                        >
                          {verificando && (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          )}
                          Confirmar que el pago llegó
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">El cliente todavía no reportó el pago.</p>
                )}
              </Bloque>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {titulo}
      </h3>
      {children}
    </section>
  )
}

function Renglon({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="tabular-nums text-gray-900">{valor}</dd>
    </div>
  )
}
