import Image from "next/image"

type Item = {
  name: string
  presentation: string
  qty: number
  price: number
  image: string
}

const items: Item[] = [
  { name: "Harina de Maíz PAN", presentation: "Bulto de 12 · 1 kg", qty: 2, price: 24.5, image: "/products/harina-pan.png" },
  { name: "Aceite Comestible", presentation: "Botella · 1 L", qty: 3, price: 3.75, image: "/products/aceite.png" },
  { name: "Arroz Blanco", presentation: "Saco · 1 kg", qty: 4, price: 1.9, image: "/products/arroz.png" },
  { name: "Café Molido Premium", presentation: "Paquete · 500 g", qty: 1, price: 6.2, image: "/products/cafe.png" },
]

export function OrderRecap() {
  const totalItems = items.reduce((n, i) => n + i.qty, 0)
  const total = items.reduce((sum, i) => sum + i.qty * i.price, 0) + 1.99 + 3.5

  return (
    <section aria-label="Resumen del pedido" className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Tu pedido</h2>
        <span className="text-sm font-medium text-gray-400">{totalItems} artículos</span>
      </div>

      <ul className="divide-y divide-gray-100">
        {items.map((item) => (
          <li key={item.name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
              <Image
                src={item.image || "/placeholder.svg"}
                alt={item.name}
                width={48}
                height={48}
                className="h-full w-full object-contain p-1"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{item.name}</p>
              <p className="text-xs text-gray-400">{item.presentation}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">${(item.qty * item.price).toFixed(2)}</p>
              <p className="text-xs text-gray-400">x{item.qty}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
        <span className="text-sm font-medium text-gray-500">Monto total procesado</span>
        <span className="text-xl font-bold text-gray-900">${total.toFixed(2)}</span>
      </div>
      <p className="mt-1 text-right text-xs text-gray-400">Pagado con Zelle (USD)</p>
    </section>
  )
}
