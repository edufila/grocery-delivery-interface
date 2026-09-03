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
   * lo estiraba: por eso se veía borroso. Estas plataformas quieren 1200x630.
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
        width: 1200,
        height: 630,
        alt: 'Una cesta con frutas y verduras',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
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
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
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
      <body className="antialiased">
        <CartProvider>{children}</CartProvider>
        <RegistrarSW />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
