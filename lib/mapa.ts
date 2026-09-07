"use client"

/**
 * Carga MapLibre y sus estilos, y solo cuando de verdad se va a dibujar un mapa.
 *
 * El JS ya se pedía a demanda, pero el CSS estaba importado arriba de los
 * componentes. Un import estático de CSS se junta con el de la página aunque el
 * JS no viaje, así que los 81 KB de estilos del mapa los descargaba TODO el
 * que abriera el inicio -- donde no hay ningún mapa, solo la hoja de direcciones
 * que casi nadie abre. Medido contra el sitio publicado, no supuesto.
 *
 * La promesa se guarda para que dos componentes con mapa en la misma pantalla
 * no pidan la librería dos veces.
 */
let cargando: Promise<typeof import("maplibre-gl")> | null = null

export function cargarMapa() {
  cargando ??= (async () => {
    const [lib] = await Promise.all([
      import("maplibre-gl"),
      // Juntos y no uno detrás del otro: si el CSS llegara después, el mapa
      // aparecería un instante sin estilo.
      import("maplibre-gl/dist/maplibre-gl.css"),
    ])
    return lib
  })()

  return cargando
}
