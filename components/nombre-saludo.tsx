"use client"

import { useEffect, useState } from "react"

import { firstName } from "@/lib/profile"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

/**
 * ", Ulises" detrás del "Buenas noches" del inicio.
 *
 * Va aparte, en el teléfono, y no en el servidor: saber quién es desde allá
 * costaba un viaje más a Supabase en la primera pantalla que carga cualquiera,
 * solo para un nombre. Aquí la sesión ya está guardada y se lee sin red; el
 * saludo sale al instante y el nombre se suma cuando se sabe.
 *
 * Primero el nombre del perfil, que es el que la persona escribió. Si no hay,
 * el de Google. Sin ninguno, no dice nada: "Buenas noches" solo está bien, y
 * "Buenas noches, ufilardo" no.
 */
export function NombreSaludo() {
  const [nombre, setNombre] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelado = false

    void (async () => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const usuario = session?.user
      if (!usuario || cancelado) return

      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", usuario.id)
        .maybeSingle<{ full_name: string | null }>()

      const delPerfil = firstName(data?.full_name)
      const deGoogle = firstName(
        (usuario.user_metadata?.full_name as string | undefined) ??
          (usuario.user_metadata?.name as string | undefined),
      )

      if (!cancelado) setNombre(delPerfil ?? deGoogle)
    })()

    return () => {
      cancelado = true
    }
  }, [])

  if (!nombre) return null

  return <span className="animate-[aparece_0.3s_ease-out]">, {nombre}</span>
}
