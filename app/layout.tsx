import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { RegistrarSW } from '@/components/pwa/registrar-sw'
import { APP_NAME, APP_SHORT_NAME, SITE_URL } from '@/lib/brand'
import { CartProvider } from '@/lib/cart'

const DESCRIPCION = 'Pide tus víveres y productos del hogar con entrega rápida a domicilio.'

export const metadata: Metadata = {
  /**
   * Las tarjetas de WhatsApp y compañía necesitan direcciones absolutas: una
   * ruta suelta como /og.png no les sirve. Con esto Next las completa solo.
   */
  metadataBase: new URL(SITE_URL),
  title: `${APP_NAME} · Delivery de supermercado`,
  description: DESCRIPCION,
  generator: 'v0.app',
  /**
   * Sin esto, al pasar el link por WhatsApp agarraba el ícono de 180 píxeles y
   * lo estiraba: por eso se veía borroso.
   *
   * Va cuadrada y no apaisada porque así WhatsApp deja la miniatura chiquita al
   * lado del texto en vez del banner grande. Es la propia imagen la que decide
   * eso, no hay ninguna etiqueta para pedirlo.
   */
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
    title: `${APP_NAME} · Delivery de supermercado`,
    description: DESCRIPCION,
    locale: 'es_VE',
    images: [
      {
        url: '/og.png',
        width: 600,
        height: 600,
        alt: 'Una cesta con frutas y verduras',
      },
    ],
  },
  twitter: {
    // "summary" es la tarjeta chica; "summary_large_image" es el banner.
    card: 'summary',
    title: `${APP_NAME} · Delivery de supermercado`,
    description: DESCRIPCION,
    images: ['/og.png'],
  },
  // Un solo ícono para claro y oscuro: el fondo verde se ve igual de bien en
  // los dos, así que no hace falta la pareja con `media` que traía la plantilla.
  icons: {
    icon: [
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
  // iOS no lee el manifest: para abrirla sin barra del navegador hace falta esto.
  appleWebApp: {
    capable: true,
    title: APP_SHORT_NAME,
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  /**
   * Sin esto, `env(safe-area-inset-*)` vale 0 y todos los paddings que la app
   * ya tiene puestos no hacen nada. Instalada en la pantalla de inicio, la
   * barra de abajo quedaba debajo de la rayita del iPhone y los textos
   * cortados. Con cover la página llega a los bordes y cada barra se separa
   * lo que el equipo diga que hace falta.
   */
  viewportFit: 'cover',
  /**
   * La app es solo clara, y hasta aquí decía lo contrario.
   *
   * Declaraba `light dark` y pedía barra negra en modo oscuro, pero justo abajo
   * se le fuerza la clase `light` al <html> porque no hay diseño oscuro.
   * Resultado: en un teléfono en modo oscuro se veía una franja negra encima de
   * una app blanca, y los campos de texto se pintaban oscuros.
   *
   * El color es blanco porque el borde de arriba de la app es la barra blanca
   * del encabezado, y con `viewportFit: cover` la página llega hasta ahí.
   */
  colorScheme: 'light',
  themeColor: 'white',
}

/**
 * La app está diseñada en claro: todas las superficies son bg-white y el texto
 * gray-900. La clase "light" en <html> desactiva el bloque de
 * prefers-color-scheme de globals.css; sin ella, en un dispositivo en modo
 * oscuro el texto heredado se vuelve blanco y desaparece sobre las tarjetas.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="light">
      {/**
       * Las pantallas de arranque de iPhone.
       *
       * Al abrir la app instalada, Android arma la suya con el icono y el color
       * del manifiesto. iOS no: sin una imagen del tamaño exacto de ese equipo
       * muestra blanco, y el arranque en frío con datos móviles dura lo
       * suficiente para que ese blanco se vea y parezca una app rota.
       *
       * Van a mano porque `metadata` de Next no tiene campo para esto. Las
       * genera `node scripts/hacer-arranque.mjs`, que imprime estas mismas
       * etiquetas: si se agrega un modelo, se copian de ahí.
       */}
      <head>
        <link
          rel="apple-touch-startup-image"
          href="/arranque/arranque-750x1334.png"
          media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/arranque/arranque-828x1792.png"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/arranque/arranque-1125x2436.png"
          media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/arranque/arranque-1170x2532.png"
          media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/arranque/arranque-1179x2556.png"
          media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/arranque/arranque-1242x2688.png"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/arranque/arranque-1284x2778.png"
          media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/arranque/arranque-1290x2796.png"
          media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
      </head>
      <body className="antialiased">
        <CartProvider>{children}</CartProvider>
        <RegistrarSW />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
