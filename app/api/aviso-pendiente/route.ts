import { createClient } from "@/lib/supabase/server"

/**
 * Qué debe decir el aviso que acaba de llegar.
 *
 * La llama el service worker cuando recibe un golpe de push. El golpe viaja sin
 * contenido -- mandarlo con texto obliga a cifrarlo con el esquema del
 * navegador, fácil de equivocar y que falla en silencio -- así que el texto se
 * pregunta aquí.
 *
 * No recibe ningún parámetro, y eso es a propósito: quién pregunta sale de su
 * sesión, no de lo que diga la petición. Si viniera un id por parámetro,
 * cualquiera podría preguntar por los avisos de otro.
 */
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Sin sesión no hay nada que contar, pero se responde bien igual: el
    // service worker muestra entonces su aviso genérico, que es suficiente.
    return Response.json({ titulo: null }, { status: 200 })
  }

  const { data, error } = await supabase.rpc("avisos_pendientes")

  if (error) return Response.json({ titulo: null }, { status: 200 })

  return Response.json(data ?? { titulo: null }, {
    status: 200,
    // Un aviso viejo servido de caché sería peor que ninguno.
    headers: { "Cache-Control": "no-store" },
  })
}
