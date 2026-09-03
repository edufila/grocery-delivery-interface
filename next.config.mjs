/** @type {import('next').NextConfig} */
const nextConfig = {
  // No ignoramos errores de tipos: si el build no compila, mejor que falle
  // acá y no que se despliegue roto a producción.
  images: {
    unoptimized: true,
  },
}

export default nextConfig
