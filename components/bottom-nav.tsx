"use client"

import { useState } from "react"
import { Home, Compass, ClipboardList, User } from "lucide-react"
import type { LucideIcon } from "lucide-react"

type NavItem = {
  label: string
  Icon: LucideIcon
}

const items: NavItem[] = [
  { label: "Home", Icon: Home },
  { label: "Explorar", Icon: Compass },
  { label: "Pedidos", Icon: ClipboardList },
  { label: "Perfil", Icon: User },
]

export function BottomNav() {
  const [active, setActive] = useState("Home")

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white/95 backdrop-blur-md"
      aria-label="Navegación principal"
    >
      <ul className="mx-auto flex max-w-md items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-2">
        {items.map(({ label, Icon }) => {
          const isActive = active === label
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => setActive(label)}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 text-xs font-medium transition ${
                  isActive ? "text-emerald-600" : "text-gray-400"
                }`}
              >
                <Icon
                  className={`h-6 w-6 ${isActive ? "fill-emerald-50" : ""}`}
                  aria-hidden="true"
                />
                {label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
