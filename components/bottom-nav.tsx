"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Compass, ClipboardList, User } from "lucide-react"
import type { LucideIcon } from "lucide-react"

type NavItem = {
  label: string
  href: string
  Icon: LucideIcon
}

const items: NavItem[] = [
  { label: "Home", href: "/", Icon: Home },
  { label: "Explorar", href: "/catalogo", Icon: Compass },
  { label: "Pedidos", href: "/tracking", Icon: ClipboardList },
  { label: "Perfil", href: "/perfil", Icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white/95 backdrop-blur-md"
      aria-label="Navegación principal"
    >
      <ul className="mx-auto flex max-w-md items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-2">
        {items.map(({ label, href, Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <li key={label}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-11 flex-col items-center gap-1 rounded-xl px-4 py-1.5 text-xs font-medium transition ${
                  isActive ? "text-emerald-600" : "text-gray-400"
                }`}
              >
                <Icon
                  className={`h-6 w-6 ${isActive ? "fill-emerald-50" : ""}`}
                  aria-hidden="true"
                />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
