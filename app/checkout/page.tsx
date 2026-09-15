import type { Metadata } from "next"

import { CheckoutView } from "@/components/checkout/checkout-view"
import { pageTitle } from "@/lib/brand"

// Sin esto la pestaña decía "Abasto · Delivery de supermercado", igual que el
// inicio: con dos pestañas abiertas no se sabía cuál era el carrito.
export const metadata: Metadata = {
  title: pageTitle("Carrito y pago"),
}

export default function CheckoutPage() {
  return <CheckoutView />
}
