"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BadgeCheck, Check, Copy, Loader2 } from "lucide-react"

import { formatMoney } from "@/lib/orders"
import { formatBolivares, montoParaBanco } from "@/lib/pagos"
import { avisarAlEquipo } from "@/lib/push-cliente"
import { createClient } from "@/lib/supabase/client"

/**
 * A dónde pagar y cómo avisar que se pagó.
 *
 * Antes el cliente elegía Pago Móvil en el checkout y ahí terminaba: nunca se
 * le decía a qué banco ni a nombre de quién, y no tenía forma de avisar que
 * había transferido. El pedido quedaba esperando un dinero que nadie sabía si
 * había llegado.
 */
export function PagarPedido({
  orderId,
  total,
  montoVes,
  instrucciones,
  referencia,
  verificado,
}: {
  orderId: string
  total: number
  /** Lo exacto a pagar en bolívares, si el método cobra en esa moneda. */
  montoVes: number | null
  instrucciones: string
  referencia: string | null
  verificado: boolean
}) {
  const router = useRouter()
  const [texto, setTexto] = useState(referencia ?? "")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const [copiado, setCopiado] = useState<"datos" | "monto" | null>(null)

  async function copiar(que: "datos" | "monto", valor: string) {
    try {
      await navigator.clipboard.writeText(valor)
      setCopiado(que)
      setTimeout(() => setCopiado(null), 2000)
    } catch {
      // Sin portapapeles queda el texto a la vista para copiarlo a mano.
    }
  }

  async function reportar() {
    const limpia = texto.trim()
    if (limpia.length < 4) {
      setError("Escribe al menos los últimos 4 dígitos de la referencia.")
      return
    }

    setGuardando(true)
    setError("")

    const { error: rpcError } = await createClient().rpc("report_payment", {
      p_order_id: orderId,
      p_reference: limpia,
    })

    setGuardando(false)

    if (rpcError) {
      setError(mensajeDeError(rpcError.message))
      return
    }

    /**
     * Se despierta a admin y dev. Este es el punto donde el pedido se detiene
     * esperando a una persona: hasta que alguien confirme el pago, no sale a
     * buscar shopper. Que el aviso llegue tarde es que el cliente espere.
     *
     * No se aguarda la respuesta: el pago ya quedó reportado y la pantalla
     * tiene que reflejarlo aunque el aviso falle.
     */
    void avisarAlEquipo("pago-reportado")
    router.refresh()
  }

  if (verificado) {
    return (
      <section className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-900">Pago confirmado</p>
          {referencia && (
            <p className="truncate text-sm text-emerald-800">Referencia {referencia}</p>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5">
      <h2 className="text-base font-semibold text-gray-900">Paga para que salga tu pedido</h2>
      {/* Literal, no una forma de apurar: hasta que el abasto confirme el pago,
          el pedido no le aparece a ningún shopper. Vale decirlo aquí para que
          nadie espere media hora creyendo que ya viene en camino. */}
      <p className="mt-1 text-sm leading-relaxed text-gray-500">
        Nadie sale a comprarlo hasta que confirmemos que llegó.
      </p>

      {/* Tres pasos numerados en vez de un bloque de texto: quien paga lo hace
          saltando entre esta pantalla y la del banco, y necesita volver y saber
          en cuál iba. */}
      <ol className="mt-4 flex flex-col gap-4">
        <Paso numero={1} titulo={montoVes != null ? "Paga el monto exacto" : "Paga el total"}>
          {/* Los céntimos no son decoración: son lo que permite identificar tu
              pago entre todos los del día, así que hay que pagarlos tal cual. */}
          {montoVes != null ? (
            <div className="rounded-xl bg-emerald-50 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-2xl font-bold tabular-nums text-emerald-900">
                  Bs. {formatBolivares(montoVes)}
                </p>
                {/* Se copia sin puntos de miles y con coma: es como lo piden las
                    apps de los bancos, y con puntos lo rechazan o lo leen mal. */}
                <BotonCopiar
                  listo={copiado === "monto"}
                  onClick={() => void copiar("monto", montoParaBanco(montoVes))}
                  etiqueta="Copiar el monto"
                />
              </div>
              <p className="mt-1 text-sm leading-relaxed text-emerald-800">
                Con los céntimos incluidos: así reconocemos tu pago.{" "}
                <span className="whitespace-nowrap">({formatMoney(total)})</span>
              </p>
            </div>
          ) : (
            <p className="text-lg font-bold tabular-nums text-gray-900">{formatMoney(total)}</p>
          )}
        </Paso>

        <Paso numero={2} titulo="A estos datos">
          {/**
           * Sin datos de pago cargados se dice, en vez de dejar el hueco.
           *
           * Puede pasar: el abasto los borra o los está cambiando. Antes, en ese
           * caso, esta pantalla entera desaparecía -- el pedido seguía detenido
           * esperando un pago, y el cliente no veía ni a dónde pagar ni por qué
           * no avanzaba. Un pedido trabado sin explicación es la peor combinación.
           */}
          {instrucciones ? (
            <div className="flex items-start justify-between gap-2 rounded-xl bg-gray-50 p-3">
              <p className="whitespace-pre-line text-sm leading-relaxed text-gray-800">
                {instrucciones}
              </p>
              <BotonCopiar
                listo={copiado === "datos"}
                onClick={() => void copiar("datos", instrucciones)}
                etiqueta="Copiar los datos de pago"
              />
            </div>
          ) : (
            <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-900">
              Ahora mismo no tenemos publicados los datos para pagar. Escríbele al abasto para que
              te los pase; cuando pagues, puedes reportar la referencia aquí abajo igual.
            </p>
          )}
        </Paso>

        <Paso numero={3} titulo={referencia ? "Tu referencia" : "Escribe la referencia"}>
          <label htmlFor="referencia" className="sr-only">
            Referencia del pago
          </label>
          <input
            id="referencia"
            value={texto}
            onChange={(event) => {
              setTexto(event.target.value)
              if (error) setError("")
            }}
            inputMode="numeric"
            autoComplete="off"
            maxLength={40}
            placeholder="Últimos dígitos de la transferencia"
            className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-base tabular-nums text-gray-900 outline-none transition placeholder:text-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </Paso>
      </ol>

      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-600">
          {error}
        </p>
      )}

      {referencia && texto.trim() === referencia && (
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          Ya la reportaste. Estamos buscándola en el banco y en cuanto la confirmemos el pedido
          sale. Si te equivocaste, corrígela aquí mismo.
        </p>
      )}

      <button
        type="button"
        onClick={() => void reportar()}
        disabled={guardando || texto.trim().length < 4 || texto.trim() === (referencia ?? "")}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-500"
      >
        {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {referencia ? "Corregir la referencia" : "Ya pagué"}
      </button>
    </section>
  )
}

function Paso({
  numero,
  titulo,
  children,
}: {
  numero: number
  titulo: string
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-3">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white"
        aria-hidden="true"
      >
        {numero}
      </span>
      <div className="min-w-0 flex-1">
        <p className="mb-2 text-sm font-semibold text-gray-900">{titulo}</p>
        {children}
      </div>
    </li>
  )
}

function BotonCopiar({
  listo,
  onClick,
  etiqueta,
}: {
  listo: boolean
  onClick: () => void
  etiqueta: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 active:bg-gray-100"
      aria-label={etiqueta}
    >
      {listo ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {listo ? "Copiado" : "Copiar"}
    </button>
  )
}

/**
 * El error de la base, dicho para el cliente.
 *
 * Antes se mostraba el mensaje tal cual llegaba: si era uno de Postgres, salía
 * en inglés y con nombres de funciones. Los que escribe `report_payment` ya
 * vienen en español y se dejan pasar.
 */
function mensajeDeError(mensaje: string) {
  if (mensaje.includes("Escribe al menos") || mensaje.includes("no es tuyo")) return mensaje
  const m = mensaje.toLowerCase()
  if (m.includes("fetch") || m.includes("network")) {
    return "Sin conexión. Revisa tus datos y vuelve a intentar."
  }
  return "No pudimos guardar la referencia. Prueba de nuevo en un momento."
}
