/**
 * Esqueleto del catálogo: la portada, la barra y la grilla de productos.
 *
 * Es la pantalla que más tarda en armarse -- trae todos los productos del
 * abasto -- y la que más se abre. Con la forma a la vista, la espera se lee
 * como "ya viene" y los productos caen en su lugar sin mover nada.
 */
export default function LoadingCatalogo() {
  return (
    <div className="min-h-dvh bg-gray-50">
      <div className="pt-barra-estado bg-white">
        <div className="mx-auto max-w-3xl px-4 pt-3">
          <div className="h-40 animate-pulse rounded-3xl bg-gray-200" />
        </div>
      </div>

      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-1 px-2 py-2.5">
          <div className="h-11 w-11 shrink-0" />
          <div className="mr-2 h-11 flex-1 animate-pulse rounded-2xl bg-gray-100" />
        </div>
        <div className="mx-auto flex max-w-3xl gap-2 overflow-hidden px-4 pb-2.5">
          {[64, 88, 72, 96, 80].map((ancho, i) => (
            <div
              key={i}
              className="h-11 shrink-0 animate-pulse rounded-full bg-gray-100"
              style={{ width: ancho }}
            />
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-4">
        <div className="mb-3 h-6 w-28 animate-pulse rounded bg-gray-200" />
        <div className="mb-4 h-11 w-32 animate-pulse rounded-full bg-gray-100" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-gray-100 bg-white"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="aspect-square animate-pulse bg-gray-100" />
              <div className="p-3">
                <div className="h-3.5 w-full animate-pulse rounded bg-gray-100" />
                <div className="mt-1.5 h-3 w-16 animate-pulse rounded bg-gray-100" />
                <div className="mt-4 flex items-end justify-between">
                  <div className="h-6 w-14 animate-pulse rounded bg-gray-200" />
                  <div className="h-11 w-11 animate-pulse rounded-full bg-gray-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p role="status" className="sr-only">
        Cargando el catálogo
      </p>
    </div>
  )
}
