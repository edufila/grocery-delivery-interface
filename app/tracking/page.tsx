import { redirect } from "next/navigation"

/** La ruta vieja del mockup. Ahora el seguimiento vive en /pedidos/[code]. */
export default function TrackingPage() {
  redirect("/pedidos")
}
