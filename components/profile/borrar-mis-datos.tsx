"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"

import { createClient } from "@/lib/supabase/client"

/**
 * Borrar mis datos, sin pedírselo a nadie (0050).
 *
 * Dos pasos: el primer toque solo abre la explicación de qué se borra y qué
 * queda. Es irreversible, y en el teléfono un toque sin querer es fácil.
 *
 * Al terminar se cierra la sesión: la cuenta queda vacía, y dejar a la persona
 * adentro de un perfil en blanco confunde más de lo que ayuda.
 */
export function BorrarMisDatos() {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function borrar() {
    setBusy(true)
    setError("")
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc("borrar_mis_datos")

    if (rpcError) {
      setBusy(false)
      const mensaje = rpcError.message ?? ""
      if (/pedido en curso|equipo se dan de baja/.test(mensaje)) setError(mensaje)
      else if (/does not exist|Could not find/.test(mensaje)) setError("Todavía no se puede: falta correr la migración 0050.")
      else setError("No pudimos borrar tus datos. Revisa tu conexión y vuelve a intentar.")
      return
    }

    await supabase.auth.signOut()
    router.replace("/")
    router.refresh()
  }

  return (
    <section
      id="borrar-datos"
      className="mt-4 scroll-mt-20 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm shadow-gray-900/[0.06]"
    >
      <h2 className="text-base font-semibold text-gray-900">Borrar mis datos</h2>

      {!abierto ? (
        <>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">
            Borra tu nombre, teléfono, direcciones y favoritos.{" "}
            <Link href="/terminos#borrar" className="font-medium text-emerald-700 underline">
              Qué se borra y qué queda
            </Link>
          </p>
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="mt-3 flex min-h-11 items-center gap-2 text-sm font-semibold text-rose-600"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Quiero borrar mis datos
          </button>
        </>
      ) : (
        <div className="mt-2">
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-700">
            <li>Se borran tu nombre, teléfono, fecha de nacimiento, direcciones, favoritos y avisos.</li>
            <li>De tus pedidos se borran la dirección, la nota y el chat.</li>
            <li>Quedan los pedidos (productos, montos y referencia del pago) y tu correo para entrar.</li>
            <li>No se puede deshacer.</li>
          </ul>

          {error && (
            <p role="alert" className="mt-3 text-sm text-rose-700">
              {error}
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setAbierto(false)
                setError("")
              }}
              disabled={busy}
              className="h-12 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700"
            >
              Mejor no
            </button>
            <button
              type="button"
              onClick={() => void borrar()}
              disabled={busy}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-rose-600 text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-600"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Borrar todo
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
