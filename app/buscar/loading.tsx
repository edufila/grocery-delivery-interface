/**
 * Esqueleto de Explorar.
 *
 * Es la segunda pestaña de la barra: se toca a cada rato. Sin esto caía el de
 * la raíz, que es el logo en grande en el medio de la pantalla -- entre dos
 * pestañas eso parece que la app se reinició. Con la forma del buscador y de
 * la lista, se lee como lo que es: la lista cargando.
 */
export default function LoadingBuscar() {
  return (
    <main className="min-h-dvh bg-gray-50 pb-24">
      <header className="pt-barra-estado sticky top-0 z-30 border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-md items-center gap-1 px-4 py-3">
          <div className="h-11 w-11 shrink-0" />
          <div className="h-12 flex-1 animate-pulse rounded-2xl bg-gray-100" />
        </div>
        <div className="mx-auto flex max-w-md gap-2 overflow-hidden px-4 pb-3">
          {[64, 88, 72, 80, 76].map((ancho, i) => (
            <div
              key={i}
              className="h-11 shrink-0 animate-pulse rounded-full bg-gray-100"
              style={{ width: ancho }}
            />
          ))}
        </div>
      </header>

      <div className="mx-auto flex max-w-md flex-col gap-2 px-4 py-4">
        <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-gray-200" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3"
          >
            <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-gray-100" />
            <div className="flex-1">
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-gray-200" />
              <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-gray-100" />
            </div>
            <div className="h-4 w-12 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>

      <p role="status" className="sr-only">
        Cargando productos
      </p>
    </main>
  )
}
