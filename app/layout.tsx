import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { CartProvider } from '@/lib/cart'

export const metadata: Metadata = {
  title: 'Gran Abasto Girasol · Delivery de supermercado',
  description: 'Pide tus víveres y productos del hogar con entrega rápida a domicilio.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
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
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
