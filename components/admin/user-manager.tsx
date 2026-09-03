"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AtSign, Check, Loader2, Search } from "lucide-react"

import type { Role } from "@/lib/orders"
import { createClient } from "@/lib/supabase/client"

export type AdminUser = {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  handle: string | null
  role: Role
}

const ROLES: { value: Role; label: string }[] = [
  { value: "cliente", label: "Cliente" },
  { value: "shopper", label: "Shopper" },
  { value: "admin", label: "Admin" },
  { value: "dev", label: "Dev" },
]

const ROLE_STYLE: Record<Role, string> = {
  cliente: "bg-gray-100 text-gray-600",
  shopper: "bg-emerald-50 text-emerald-700",
  admin: "bg-gray-900 text-white",
  dev: "bg-gray-900 text-white",
}

export function UserManager({ users, meId }: { users: AdminUser[]; meId: string }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [handles, setHandles] = useState<Record<string, string>>(
    Object.fromEntries(users.map((u) => [u.id, u.handle ?? ""])),
  )
  const [names, setNames] = useState<Record<string, string>>(
    Object.fromEntries(users.map((u) => [u.id, u.full_name ?? ""])),
  )
  const [avatars, setAvatars] = useState<Record<string, string>>(
    Object.fromEntries(users.map((u) => [u.id, u.avatar_url ?? ""])),
  )

  const term = query.trim().toLowerCase()
  const shown = term
    ? users.filter(
        (u) =>
          u.email?.toLowerCase().includes(term) ||
          u.full_name?.toLowerCase().includes(term) ||
          u.handle?.includes(term),
      )
    : users

  async function setRole(user: AdminUser, role: Role) {
    setBusyId(user.id)
    setError("")
    const { error: rpcError } = await createClient().rpc("admin_set_role", {
      p_user: user.id,
      p_role: role,
    })
    setBusyId(null)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    router.refresh()
  }

  async function saveIdentity(user: AdminUser) {
    setBusyId(user.id)
    setError("")
    const { error: rpcError } = await createClient().rpc("admin_set_identity", {
      p_user: user.id,
      p_full_name: names[user.id] ?? "",
      p_avatar_url: avatars[user.id] ?? "",
    })
    setBusyId(null)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    router.refresh()
  }

  async function saveHandle(user: AdminUser) {
    setBusyId(user.id)
    setError("")
    const { error: rpcError } = await createClient().rpc("admin_set_handle", {
      p_user: user.id,
      p_handle: handles[user.id] ?? "",
    })
    setBusyId(null)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="relative block">
        <span className="sr-only">Buscar usuario</span>
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por correo, nombre o @"
          className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}

      {shown.length === 0 && (
        <p className="text-sm text-gray-500">Nadie coincide con esa búsqueda.</p>
      )}

      <ul className="flex flex-col gap-2">
        {shown.map((user) => {
          const esShopper = user.role === "shopper"
          const handleChanged = (handles[user.id] ?? "") !== (user.handle ?? "")

          return (
            <li key={user.id} className="rounded-2xl border border-gray-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {user.full_name || user.email || "Sin nombre"}
                    {user.id === meId && (
                      <span className="ml-2 text-xs font-normal text-gray-400">(vos)</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-gray-500">{user.email}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${ROLE_STYLE[user.role]}`}
                >
                  {user.role}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {ROLES.map((role) => (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => void setRole(user, role.value)}
                    disabled={busyId === user.id || user.role === role.value}
                    className={`min-h-9 rounded-full px-3 text-sm font-medium transition ${
                      user.role === role.value
                        ? "bg-gray-900 text-white"
                        : "border border-gray-200 text-gray-600 active:bg-gray-50"
                    } disabled:opacity-60`}
                  >
                    {role.label}
                  </button>
                ))}
                {busyId === user.id && (
                  <Loader2 className="mt-2 h-4 w-4 animate-spin text-gray-400" aria-hidden="true" />
                )}
              </div>

              {esShopper && (
                <div className="mt-3 rounded-xl bg-gray-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Como lo ve el cliente
                  </p>

                  <div className="mt-2 flex items-center gap-3">
                    {avatars[user.id] ? (
                      <img
                        src={avatars[user.id]}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-full bg-gray-200 object-cover"
                      />
                    ) : (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-500">
                        sin foto
                      </span>
                    )}
                    <input
                      value={names[user.id] ?? ""}
                      onChange={(event) => setNames({ ...names, [user.id]: event.target.value })}
                      placeholder="Nombre visible"
                      aria-label="Nombre visible del shopper"
                      className="h-11 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500"
                    />
                  </div>

                  <input
                    value={avatars[user.id] ?? ""}
                    onChange={(event) => setAvatars({ ...avatars, [user.id]: event.target.value })}
                    placeholder="URL de la foto: /images/shoppers/andres.jpg"
                    aria-label="Foto del shopper"
                    className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500"
                  />

                  <button
                    type="button"
                    onClick={() => void saveIdentity(user)}
                    disabled={busyId === user.id}
                    className="mt-2 flex h-11 w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400"
                  >
                    Guardar nombre y foto
                  </button>
                </div>
              )}

              {esShopper && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="relative flex-1">
                    <AtSign
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                      aria-hidden="true"
                    />
                    <input
                      value={handles[user.id] ?? ""}
                      onChange={(event) =>
                        setHandles({ ...handles, [user.id]: event.target.value })
                      }
                      placeholder="andres"
                      aria-label={`@ de ${user.full_name ?? user.email}`}
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500"
                    />
                  </span>
                  <button
                    type="button"
                    onClick={() => void saveHandle(user)}
                    disabled={busyId === user.id || !handleChanged}
                    className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400"
                  >
                    {!handleChanged && user.handle && (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    )}
                    Guardar
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
