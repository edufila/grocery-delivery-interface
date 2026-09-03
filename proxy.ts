import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config"

// En Next 16 este archivo reemplaza al viejo middleware.ts.

/**
 * Rutas que exigen sesión iniciada.
 *
 * Mientras no haya ningún proveedor de login habilitado en Supabase, solo
 * protegemos el perfil: si acá metemos /checkout o /tracking, la app queda
 * inusable porque el login todavía no se puede completar. Volver a agregarlos
 * cuando la autenticación funcione de punta a punta.
 */
const PROTECTED_ROUTES = ["/perfil", "/pedidos"]

function requiresAuth(pathname: string) {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )
}

export async function proxy(request: NextRequest) {
  // Sin credenciales cargadas la app funciona igual, solo que sin auth.
  if (!isSupabaseConfigured) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // getUser() valida el token contra Supabase y de paso refresca la sesión.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && requiresAuth(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    // Todo menos assets estáticos e imágenes.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
