"use client"

import { useEffect, useState } from "react"
import { Download, Share, SquarePlus, X } from "lucide-react"

import { APP_SHORT_NAME } from "@/lib/brand"

/**
 * El evento que dispara Chrome cuando la app cumple con lo que pide para ser
 * instalable. No está en los tipos del navegador porque solo lo implementan
 * los que derivan de Chromium.
 */
type EventoInstalar = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function esIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function yaInstalada() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS no implementa display-mode: standalone; usa su propia bandera.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * Ofrece instalar la app en la pantalla de inicio.
 *
 * En Android abre el diálogo del sistema. En iPhone no se puede: Apple no
 * expone ninguna forma de pedirlo, así que lo único honesto es explicar los dos
 * toques que hay que dar.
 *
 * Importa más de lo que parece: instalada, la app abre sin la barra del
 * navegador -- el shopper la usa decenas de veces por turno -- y en iPhone es
 * la única forma de que algún día lleguen las notificaciones.
 */
export function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null)
  const [instalada, setInstalada] = useState(true)
  const [ios, setIos] = useState(false)
  const [pasos, setPasos] = useState(false)

  useEffect(() => {
    setInstalada(yaInstalada())
    setIos(esIOS())

    const alPoder = (e: Event) => {
      // Sin esto Chrome muestra su propia barra abajo, y quedan dos ofertas.
      e.preventDefault()
      setEvento(e as EventoInstalar)
    }
    const alInstalar = () => {
      setInstalada(true)
      setEvento(null)
    }

    window.addEventListener("beforeinstallprompt", alPoder)
    window.addEventListener("appinstalled", alInstalar)
    return () => {
      window.removeEventListener("beforeinstallprompt", alPoder)
      window.removeEventListener("appinstalled", alInstalar)
    }
  }, [])

  async function instalar() {
    if (!evento) return
    await evento.prompt()
    const { outcome } = await evento.userChoice
    // El evento sirve una sola vez: si dijo que no, Chrome lo vuelve a mandar
    // más adelante por su cuenta.
    setEvento(null)
    if (outcome === "accepted") setInstalada(true)
  }

  if (instalada) return null
  // En iPhone siempre se ofrece, porque el evento no existe. En el resto, solo
  // cuando el navegador avisó que se puede: si no, el botón no haría nada.
  if (!ios && !evento) return null

  return (
    <>
      <button
        type="button"
        onClick={() => (ios ? setPasos(true) : void instalar())}
        className="flex w-full items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-left active:bg-emerald-50"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
          <Download className="h-5 w-5 text-emerald-600" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-gray-900">
            Instalar {APP_SHORT_NAME} en tu teléfono
          </span>
          <span className="block text-sm leading-relaxed text-gray-500">
            Se abre a pantalla completa, sin la barra del navegador.
          </span>
        </span>
      </button>

      {pasos && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={`Instalar ${APP_SHORT_NAME}`}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setPasos(false)}
            aria-label="Cerrar"
          />

          <div className="relative w-full max-w-lg rounded-t-3xl bg-white pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
            <div className="mx-auto h-1 w-10 rounded-full bg-gray-200" aria-hidden="true" />

            <div className="flex items-center justify-between px-5 pb-1 pt-4">
              <h2 className="text-base font-semibold text-gray-900">
                Agregar a la pantalla de inicio
              </h2>
              <button
                type="button"
                onClick={() => setPasos(false)}
                className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <p className="px-5 text-sm leading-relaxed text-gray-500">
              En iPhone esto se hace a mano, Apple no deja hacerlo de otra forma. Tiene que ser
              desde Safari.
            </p>

            <ol className="mt-4 flex flex-col gap-3 px-5">
              <li className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                  1
                </span>
                <span className="flex items-center gap-1.5 pt-1 text-sm leading-relaxed text-gray-700">
                  Toca <Share className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <span className="font-semibold">Compartir</span>, abajo en la barra.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                  2
                </span>
                <span className="flex items-center gap-1.5 pt-1 text-sm leading-relaxed text-gray-700">
                  Baja y elige{" "}
                  <SquarePlus className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <span className="font-semibold">Agregar a pantalla de inicio</span>.
                </span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  )
}
