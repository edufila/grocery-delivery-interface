"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Home, Compass, ClipboardList, User } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { usuarioEnTelefono } from "@/lib/sesion"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

type NavItem = {
  label: string
  href: string
  Icon: LucideIcon
}

const items: NavItem[] = [
  { label: "Inicio", href: "/", Icon: Home },
  // A /buscar y no al catálogo: explorar es en todos los abastos, no en el
  // primero de la lista, que es donde caía antes.
  { label: "Explorar", href: "/buscar", Icon: Compass },
  { label: "Pedidos", href: "/pedidos", Icon: ClipboardList },
  { label: "Perfil", href: "/perfil", Icon: User },
]

const EN_CURSO = ["confirmado", "preparando", "en_camino"]

export function BottomNav() {
  const pathname = usePathname()
  const [activos, setActivos] = useState(0)

  /**
   * Un punto en Pedidos cuando hay uno en curso. Sin esto, alguien que cerró
   * la app no tiene forma de saber que su pedido avanzó salvo entrando a
   * buscarlo.
   */
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false

    void (async () => {
      const supabase = createClient()
      const user = await usuarioEnTelefono(supabase)
      if (!user || cancelled) return

      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("status", EN_CURSO)

      if (!cancelled) setActivos(count ?? 0)
    })()

    return () => {
      cancelled = true
    }
    // Se recalcula al cambiar de pantalla, que es cuando puede haber cambiado.
  }, [pathname])

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white/95 backdrop-blur-md"
      aria-label="Navegación principal"
    >
      <ul className="mx-auto flex max-w-md items-center justify-around px-2 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-1.5">
        {items.map(({ label, href, Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href)
          const badge = label === "Pedidos" && activos > 0

          return (
            <li key={label}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                aria-label={
                  badge
                    ? `${label}, ${activos} en curso`
                    : undefined
                }
                className={`flex min-h-11 flex-col items-center gap-0.5 px-2 py-1 text-xs transition ${
                  isActive ? "font-semibold text-emerald-700" : "font-medium text-gray-500"
                }`}
              >
                {/* La pastilla detrás del icono marca dónde se está sin depender
                    solo del color, que con sol en la pantalla casi no se ve. */}
                <span
                  className={`relative flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200 ${
                    isActive ? "bg-emerald-100" : "bg-transparent"
                  }`}
                >
                  <Icon
                    className="h-[22px] w-[22px]"
                    strokeWidth={isActive ? 2.4 : 2}
                    aria-hidden="true"
                  />
                  {badge && (
                    <span
                      className="absolute right-1 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-white"
                      aria-hidden="true"
                    >
                      {activos}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
