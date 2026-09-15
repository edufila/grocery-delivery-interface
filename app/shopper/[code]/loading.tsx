/**
 * Esqueleto de un pedido del shopper: dirección, lista y mapa.
 *
 * Tiene que existir: sin él, Next usa el de la carpeta de arriba, que es la
 * lista de pedidos, y abrir uno mostraba "En curso / Disponibles" un instante.
 */
export default function LoadingPedidoShopper() {
  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="pt-barra-estado sticky top-0 z-20 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
          <div className="h-11 w-11 shrink-0" />
          <div className="animate-pulse">
            <div className="h-5 w-32 rounded bg-gray-200" />
            <div className="mt-1.5 h-3.5 w-44 rounded bg-gray-100" />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pb-10 pt-4">
        <div className="h-28 animate-pulse rounded-2xl border border-gray-100 bg-white" />
        <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-5">
          <div className="h-4 w-28 rounded bg-gray-200" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="mt-4 flex items-center gap-3">
              <div className="h-14 w-14 rounded-xl bg-gray-100" />
              <div className="flex-1">
                <div className="h-3.5 w-2/3 rounded bg-gray-200" />
                <div className="mt-2 h-3 w-1/3 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
        <div className="h-56 animate-pulse rounded-2xl bg-gray-200/70" />
      </div>

      <p role="status" className="sr-only">
        Cargando el pedido
      </p>
    </main>
  )
}
