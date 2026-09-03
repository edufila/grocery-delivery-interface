import { NextResponse } from "next/server"

import { safeNextPath } from "@/lib/safe-path"
import { createClient } from "@/lib/supabase/server"

/**
 * Vuelta de Google OAuth: Supabase redirige acá con un `code` que hay que
 * canjear por una sesión antes de mandar al usuario a donde iba.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = safeNextPath(searchParams.get("next"))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  const failure = new URL("/login", origin)
  failure.searchParams.set("error", "oauth")
  failure.searchParams.set("next", next)
  return NextResponse.redirect(failure)
}
