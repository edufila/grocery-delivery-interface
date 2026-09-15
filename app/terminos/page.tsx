import type { Metadata } from "next"
import Link from "next/link"
import { MessageCircle } from "lucide-react"

import { BackButton } from "@/components/back-button"
import { APP_NAME, pageTitle } from "@/lib/brand"
import { soportePublico } from "@/lib/datos-publicos"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export const metadata: Metadata = {
  title: pageTitle("Términos y privacidad"),
  description: `Cómo funciona ${APP_NAME}, qué datos guarda, quién los ve y cómo borrarlos.`,
}

// Estática, rehecha cada minuto: lo único que cambia es el WhatsApp de soporte.
export const revalidate = 60

/**
 * Términos y política de datos, en una sola página y en el idioma de quien
 * compra.
 *
 * REGLA: aquí solo va lo que la app hace de verdad. Cada frase sale del código
 * o de una migración; si algo cambia (un método de pago, qué ve el shopper,
 * cuánto se guarda), se cambia también aquí. Una política que promete algo que
 * el sistema no cumple es peor que no tener ninguna.
 *
 * No es asesoría legal: cuando haya empresa registrada, que la revise alguien
 * que sepa.
 */
const ACTUALIZADO = "15 de septiembre de 2026"

export default async function TerminosPage() {
  const soporte = isSupabaseConfigured ? await soportePublico() : null

  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="pt-barra-estado sticky top-0 z-20 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <BackButton fallback="/perfil" label="Volver" />
          <h1 className="text-base font-semibold text-gray-900">Términos y privacidad</h1>
        </div>
      </header>

      <article className="mx-auto max-w-2xl px-4 pb-16 pt-6 text-[15px] leading-relaxed text-gray-700">
        <p className="text-sm text-gray-500">Actualizado el {ACTUALIZADO}</p>

        <p className="mt-4">
          {APP_NAME} te conecta con abastos de Acarigua y Araure: eliges el local, armas el pedido y
          una persona del equipo (el shopper) lo compra y te lo lleva. Usar la app es aceptar lo que
          dice esta página. Está escrita para que se entienda; si algo no queda claro, escríbenos.
        </p>

        <nav aria-label="En esta página" className="mt-5 flex flex-wrap gap-2">
          {[
            ["#pedidos", "Pedidos"],
            ["#pagos", "Pagos"],
            ["#cancelar", "Cancelar"],
            ["#datos", "Tus datos"],
            ["#borrar", "Borrar tus datos"],
          ].map(([href, texto]) => (
            <a
              key={href}
              href={href}
              className="inline-flex min-h-11 items-center rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700"
            >
              {texto}
            </a>
          ))}
        </nav>

        <Seccion id="pedidos" titulo="Pedidos y precios">
          <p>
            Cada pedido es de un solo abasto. Los precios están en dólares y los pone el abasto; el
            total lo calcula el sistema al momento de pedir, con el costo de envío del abasto y la
            tarifa de servicio, y los ves antes de confirmar.
          </p>
          <p>
            Si pagas en bolívares, el monto se calcula con la tasa del día y queda fijo en tu pedido:
            si la tasa cambia después, lo que debes no cambia.
          </p>
          <p>
            Un precio o un agotado recién cambiado por el abasto puede tardar hasta un minuto en
            verse en la app. Si al pedir algo ya no está, el sistema no deja hacer el pedido y te
            dice qué quitar.
          </p>
          <p>
            Si un producto falta en el anaquel, el shopper hace lo que elegiste en el carrito para
            ese caso. Cada abasto tiene un horario: fuera de él no se puede pedir.
          </p>
        </Seccion>

        <Seccion id="entrega" titulo="Entrega">
          <p>
            La dirección necesita el punto marcado en el mapa: sin él no hay a dónde llevarlo. Al
            llegar, el shopper te pide el código de cuatro dígitos que ves en tu pedido. No lo
            compartas antes de tener tus cosas en la mano.
          </p>
          <p>
            El tiempo de entrega que se muestra es aproximado. Mientras el pedido va en camino puedes
            ver dónde está el shopper y escribirle por el chat del pedido.
          </p>
        </Seccion>

        <Seccion id="pagos" titulo="Pagos">
          <p>
            Con Pago Móvil pagas desde tu banco el monto exacto que te muestra la app y escribes la
            referencia.{" "}
            <strong className="font-semibold text-gray-900">
              Tu pedido no sale a comprarse hasta que el equipo confirma que el pago llegó.
            </strong>{" "}
            En efectivo, pagas al recibir.
          </p>
          <p>
            {APP_NAME} no entra a tu banco, no te pide claves y no guarda datos de tarjetas. Nadie
            del equipo te va a pedir una clave bancaria: si alguien lo hace, no es de aquí.
          </p>
        </Seccion>

        <Seccion id="cancelar" titulo="Cancelar un pedido">
          <p>
            Puedes cancelarlo desde el seguimiento mientras ningún shopper lo haya tomado. Después,
            ya hay alguien comprando: escríbele por el chat del pedido.
          </p>
          <p>
            Si cancelas un pedido que ya pagaste, el pago se devuelve. El equipo lo registra y te
            contacta para coordinar la devolución.
          </p>
        </Seccion>

        <Seccion id="datos" titulo="Qué datos guardamos">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Tu correo, para que puedas entrar. Si entras con Google, Google nos da tu correo y tu nombre.</li>
            <li>Tu nombre, tu teléfono y, si quieres, tu fecha de nacimiento.</li>
            <li>Tus direcciones, con el punto que marcas en el mapa.</li>
            <li>Tus pedidos: qué pediste, cuánto pagaste, cómo y la referencia del pago.</li>
            <li>Los mensajes del chat de cada pedido.</li>
            <li>Tus abastos y productos favoritos.</li>
            <li>Si activas los avisos, un identificador de tu teléfono para poder mandártelos.</li>
          </ul>
          <p>
            Tu ubicación solo se usa cuando tú tocas para marcar el punto de una dirección. La app no
            te sigue.
          </p>
        </Seccion>

        <Seccion id="quien" titulo="Quién los ve">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="font-semibold text-gray-900">El shopper que toma tu pedido</strong> ve
              tu primer nombre y tu teléfono, y solo mientras el pedido está en curso.
            </li>
            <li>
              <strong className="font-semibold text-gray-900">Los shoppers disponibles</strong> ven el
              pedido, la dirección y la nota mientras nadie lo ha tomado, para decidir quién lo lleva.
              Tu nombre y tu teléfono no.
            </li>
            <li>
              <strong className="font-semibold text-gray-900">El equipo que administra</strong> ve los
              pedidos y los pagos, para confirmarlos y resolver problemas.
            </li>
            <li>Nadie más. No vendemos ni compartimos tus datos para publicidad.</li>
          </ul>
          <p>
            Mientras un pedido va en camino, el teléfono del shopper envía su ubicación para que la
            veas en el mapa. Cuando el pedido se entrega o se cancela, esa ubicación se borra.
          </p>
          <p>
            Para funcionar, la app usa servicios de terceros: Supabase guarda los datos, Vercel sirve
            la app, OpenStreetMap dibuja los mapas y OSRM calcula la ruta, para lo que recibe los
            puntos de salida y de llegada.
          </p>
        </Seccion>

        <Seccion id="borrar" titulo="Borrar tus datos">
          <p>
            Desde{" "}
            <Link href="/perfil#borrar-datos" className="font-semibold text-emerald-700 underline">
              Perfil
            </Link>{" "}
            puedes borrarlos tú mismo, sin pedírselo a nadie. Se borran tu nombre, teléfono, fecha de
            nacimiento, direcciones, favoritos y avisos, y de tus pedidos la dirección, la nota y el
            chat.
          </p>
          <p>
            Quedan los pedidos en sí (qué se compró, montos y referencia del pago), porque son el
            registro de un cobro, y tu correo para entrar. Si también quieres borrar la cuenta,
            escríbenos.
          </p>
        </Seccion>

        <Seccion id="contacto" titulo="Contacto">
          {soporte ? (
            <a
              href={`https://wa.me/${soporte}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-semibold text-white transition active:scale-[0.99] sm:w-auto sm:px-6"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Escríbenos por WhatsApp
            </a>
          ) : (
            <p>
              Si tienes un pedido, escríbenos por el chat del pedido. Pronto habrá un WhatsApp de
              soporte aquí.
            </p>
          )}
          <p>Si cambiamos algo importante de esta página, cambia también la fecha de arriba.</p>
        </Seccion>
      </article>
    </main>
  )
}

function Seccion({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-8 scroll-mt-20 space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">{titulo}</h2>
      {children}
    </section>
  )
}
