/**
 * Esqueleto del seguimiento de un pedido.
 *
 * Hace falta uno propio: sin él, Next usa el de la carpeta de arriba, que es la
 * lista de pedidos, y abrir un pedido mostraba "Tus pedidos" con tres renglones
 * que no tenían nada que ver con lo que venía.
 *
 * Tiene la forma de lo que llega -- la tarjeta verde del estado, el mapa, el
 * detalle -- para que al cargar las cosas aparezcan en su lugar y no salten.
 */
export default function LoadingPedido() {
  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="pt-barra-estado sticky top-0 z-20 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
          <div className="h-11 w-11 shrink-0" />
          <div className="animate-pulse">
            <div className="h-5 w-32 rounded bg-gray-200" />
            <div className="mt-1.5 h-3.5 w-40 rounded bg-gray-100" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-4 px-4 pb-10 pt-4">
        <div className="animate-pulse rounded-3xl bg-emerald-600/80 p-5">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white/20" />
            <div className="flex-1 pt-1">
              <div className="h-5 w-40 rounded bg-white/30" />
              <div className="mt-2 h-3.5 w-52 rounded bg-white/20" />
            </div>
          </div>
          <div className="mt-6 flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-1.5 flex-1 rounded-full bg-white/25" />
            ))}
          </div>
        </div>

        <div className="h-56 animate-pulse rounded-2xl bg-gray-200/70" />

        <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-5">
          <div className="h-4 w-24 rounded bg-gray-200" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="mt-4 flex justify-between">
              <div className="h-3.5 w-40 rounded bg-gray-100" />
              <div className="h-3.5 w-12 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>

      <p role="status" className="sr-only">
        Cargando tu pedido
      </p>
    </main>
  )
}
