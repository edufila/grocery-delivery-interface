"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

const COLORES = ["#10b981", "#f59e0b", "#f43f5e", "#0ea5e9", "#a3e635", "#fde68a"]

/** Pseudoaleatorio fijo: el mismo número para la misma semilla, sin saltos. */
function azar(semilla: number) {
  const x = Math.sin(semilla * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Confeti al llegar al seguimiento recién hecho el pedido.
 *
 * Hacer un pedido era tocar un botón y aparecer en otra pantalla, sin nada que
 * marcara que eso fue lo importante. Es el momento que más vale celebrar: la
 * persona acaba de confiar su compra.
 *
 * Sale una sola vez. El checkout manda `?nuevo=1`, y lo primero que se hace aquí
 * es borrarlo de la dirección: si no, recargar la página o volver con el botón
 * de atrás tiraba confeti otra vez sobre un pedido de hace una hora.
 *
 * Solo CSS, sin librería: son unos cuadritos que caen, no vale sumar peso por
 * eso. Y quien pidió menos movimiento al sistema no lo ve (globals.css).
 */
export function FestejoPedido({ nuevo }: { nuevo: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const [visible, setVisible] = useState(nuevo)

  useEffect(() => {
    if (!nuevo) return

    router.replace(pathname, { scroll: false })

    try {
      navigator.vibrate?.([20, 60, 20])
    } catch {
      // Sin vibración no pasa nada.
    }

    const listo = window.setTimeout(() => setVisible(false), 2800)
    return () => window.clearTimeout(listo)
  }, [nuevo, pathname, router])

  if (!visible) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 40 }, (_, i) => (
        <span
          key={i}
          className="absolute -top-4 block rounded-[2px] animate-[confeti_var(--dur)_ease-in_forwards]"
          style={
            {
              left: `${azar(i + 1) * 100}%`,
              width: `${6 + azar(i + 101) * 6}px`,
              height: `${8 + azar(i + 201) * 8}px`,
              background: COLORES[i % COLORES.length],
              animationDelay: `${azar(i + 301) * 450}ms`,
              "--dur": `${1700 + azar(i + 401) * 900}ms`,
              "--giro": `${(azar(i + 501) > 0.5 ? 1 : -1) * (360 + azar(i + 601) * 540)}deg`,
              "--deriva": `${(azar(i + 701) - 0.5) * 140}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
