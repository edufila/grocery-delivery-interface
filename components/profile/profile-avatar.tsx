"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { User } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

type State = {
  loading: boolean
  photo: string | null
  initials: string | null
}

/** "María González" -> "MG". Cae al correo si no hay nombre cargado. */
export function initialsFrom(value: string) {
  const clean = value.trim()
  if (!clean) return null
  const source = clean.includes("@") ? clean.split("@")[0] : clean
  const parts = source.split(/[\s._-]+/).filter(Boolean).slice(0, 2)
  const letters = parts.map((part) => part[0]).join("")
  return letters ? letters.toUpperCase() : null
}

export function ProfileAvatar() {
  const [state, setState] = useState<State>({ loading: true, photo: null, initials: null })

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setState({ loading: false, photo: null, initials: null })
      return
    }

    let cancelled = false

    void (async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (!cancelled) setState({ loading: false, photo: null, initials: null })
        return
      }

      // El nombre del perfil manda sobre el que vino del proveedor: es el que
      // la persona editó a mano.
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle<{ full_name: string | null }>()

      const name =
        profile?.full_name ||
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        user.email ||
        ""

      if (!cancelled) {
        setState({
          loading: false,
          photo: (user.user_metadata?.avatar_url as string | undefined) ?? null,
          initials: initialsFrom(name),
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Link
      href="/perfil"
      // 44px de área táctil alrededor de un círculo de 36px.
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
      aria-label="Perfil"
    >
      <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
        {state.loading ? (
          <span className="h-full w-full animate-pulse bg-gray-200" aria-hidden="true" />
        ) : state.photo ? (
          <img src={state.photo} alt="" className="h-full w-full object-cover" />
        ) : state.initials ? (
          state.initials
        ) : (
          <User className="h-4 w-4 text-gray-500" aria-hidden="true" />
        )}
      </span>
    </Link>
  )
}
