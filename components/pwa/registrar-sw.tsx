"use client"

import { useEffect } from "react"

/**
 * Registra el service worker. Va en el layout, así corre en toda la app.
 *
 * En desarrollo no: un service worker sirviendo respuestas viejas mientras uno
 * edita código es de los ratos más frustrantes que hay.
 */
export function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return

    // Después de load: registrarlo antes compite por ancho de banda con lo que
    // la pantalla necesita para pintarse.
    const registrar = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sin service worker la app funciona igual; solo se pierde la pantalla
        // de sin conexión y el botón de instalar en Android.
      })
    }

    if (document.readyState === "complete") registrar()
    else window.addEventListener("load", registrar, { once: true })

    return () => window.removeEventListener("load", registrar)
  }, [])

  return null
}
