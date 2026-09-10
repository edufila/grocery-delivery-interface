/** @type {import('next').NextConfig} */
const nextConfig = {
  // No ignoramos errores de tipos: si el build no compila, mejor que falle
  // acá y no que se despliegue roto a producción.
  images: {
    /**
     * Sin optimizar, y no por gusto.
     *
     * Se intentó encenderla: el endpoint que redimensiona funciona -- deja una
     * foto de 2,6 MB en 255 KB -- pero `next/image` dibuja en blanco, también
     * en un build de producción. Casi seguro porque falta `sharp`, y en este
     * proyecto `npm install` está roto desde hace rato.
     *
     * Vale la pena volver a esto cuando se pueda instalar: es la diferencia
     * entre megabytes y kilobytes en la primera pantalla que carga cualquiera
     * con datos móviles. Mientras tanto el peso se controla achicando los
     * archivos antes de subirlos -- ver `scripts/achicar-fotos.mjs` -- y el
     * recortador del panel ya guarda en WebP.
     */
    unoptimized: true,
  },
}

export default nextConfig
