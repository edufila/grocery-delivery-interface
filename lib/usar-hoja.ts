"use client"

import { useEffect, useRef } from "react"

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Lo que toda hoja que sube desde abajo necesita para no dejar a nadie afuera.
 *
 * Antes cada hoja se abría sobre la página y el foco se quedaba atrás: con
 * lector de pantalla se seguía leyendo lo de abajo, y con teclado Tab recorría
 * botones tapados por el velo. Al cerrar, el foco quedaba en ninguna parte.
 *
 * Esto hace cuatro cosas mientras `abierta` es verdadero:
 *   - lleva el foco al primer control de la hoja,
 *   - no deja que Tab salga de ella,
 *   - Escape la cierra,
 *   - al cerrar devuelve el foco a lo que la abrió;
 * y además frena el scroll de la página de atrás.
 *
 * Devuelve la ref para ponerle al contenedor de la hoja.
 */
export function useHoja<T extends HTMLElement>(abierta: boolean, onCerrar: () => void) {
  const ref = useRef<T>(null)
  const cerrar = useRef(onCerrar)
  cerrar.current = onCerrar

  useEffect(() => {
    if (!abierta) return

    const anterior = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    // En la vuelta siguiente: el efecto corre con la hoja ya en el DOM.
    const id = window.setTimeout(() => {
      const primero = ref.current?.querySelector<HTMLElement>(ENFOCABLES)
      ;(primero ?? ref.current)?.focus({ preventScroll: true })
    }, 0)

    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        cerrar.current()
        return
      }
      if (evento.key !== "Tab" || !ref.current) return

      const controles = [...ref.current.querySelectorAll<HTMLElement>(ENFOCABLES)].filter(
        (el) => el.offsetParent !== null,
      )
      if (controles.length === 0) return
      const primero = controles[0]
      const ultimo = controles[controles.length - 1]

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault()
        primero.focus()
      }
    }

    window.addEventListener("keydown", alTeclear)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener("keydown", alTeclear)
      document.body.style.overflow = overflow
      anterior?.focus?.({ preventScroll: true })
    }
  }, [abierta])

  return ref
}
