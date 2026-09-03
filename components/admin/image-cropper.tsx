"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, ZoomIn } from "lucide-react"

export type CropShape = { width: number; height: number; round?: boolean }

/**
 * Encuadre antes de subir. La foto del teléfono nunca viene con la proporción
 * que necesita la tarjeta, y recortarla sola por el centro deja al producto
 * afuera. Aquí se arrastra y se acerca hasta que quede como tiene que verse.
 */
export function ImageCropper({
  file,
  shape,
  busy,
  onCancel,
  onDone,
}: {
  file: File
  shape: CropShape
  busy: boolean
  onCancel: () => void
  onDone: (blob: Blob) => void
}) {
  const [src, setSrc] = useState<string>("")
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const frameRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<{ x: number; y: number } | null>(null)

  const ratio = shape.height / shape.width

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)

    const img = new Image()
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = url

    return () => URL.revokeObjectURL(url)
  }, [file])

  /** Escala mínima para que la foto cubra el marco, sin bordes vacíos. */
  function coverScale(frameW: number, frameH: number) {
    if (!natural) return 1
    return Math.max(frameW / natural.w, frameH / natural.h)
  }

  function clamp(next: { x: number; y: number }, frameW: number, frameH: number) {
    if (!natural) return next
    const k = coverScale(frameW, frameH) * zoom
    const drawnW = natural.w * k
    const drawnH = natural.h * k
    return {
      x: Math.min(0, Math.max(frameW - drawnW, next.x)),
      y: Math.min(0, Math.max(frameH - drawnH, next.y)),
    }
  }

  // Al cambiar el zoom hay que reencuadrar, o quedan franjas en blanco.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    setOffset((prev) => clamp(prev, frame.clientWidth, frame.clientWidth * ratio))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, natural])

  function onPointerDown(event: React.PointerEvent) {
    dragging.current = { x: event.clientX - offset.x, y: event.clientY - offset.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: React.PointerEvent) {
    const start = dragging.current
    const frame = frameRef.current
    if (!start || !frame) return
    setOffset(
      clamp(
        { x: event.clientX - start.x, y: event.clientY - start.y },
        frame.clientWidth,
        frame.clientWidth * ratio,
      ),
    )
  }

  function onPointerUp() {
    dragging.current = null
  }

  function crop() {
    const frame = frameRef.current
    if (!frame || !natural) return

    const frameW = frame.clientWidth
    const frameH = frameW * ratio
    const k = coverScale(frameW, frameH) * zoom

    // De coordenadas de pantalla a coordenadas de la foto original.
    const sx = -offset.x / k
    const sy = -offset.y / k
    const sw = frameW / k
    const sh = frameH / k

    const canvas = document.createElement("canvas")
    canvas.width = shape.width
    canvas.height = shape.height

    const img = new Image()
    img.onload = () => {
      canvas.getContext("2d")?.drawImage(img, sx, sy, sw, sh, 0, 0, shape.width, shape.height)
      canvas.toBlob((blob) => blob && onDone(blob), "image/webp", 0.85)
    }
    img.src = src
  }

  const frameW = frameRef.current?.clientWidth ?? 0
  const k = natural && frameW ? coverScale(frameW, frameW * ratio) * zoom : 1

  return (
    // max-w acotado: en pantalla ancha el marco crecía hasta empujar el zoom y
    // los botones fuera de la vista, y no había forma de confirmar el recorte.
    <div className="mx-auto flex w-full max-w-[22rem] flex-col gap-3">
      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ aspectRatio: `${shape.width} / ${shape.height}` }}
        className={`relative w-full touch-none select-none overflow-hidden bg-gray-900 ${
          shape.round ? "rounded-full" : "rounded-xl"
        }`}
      >
        {src && natural && (
          <img
            src={src}
            alt=""
            draggable={false}
            style={{
              width: natural.w * k,
              height: natural.h * k,
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}
            className="max-w-none origin-top-left cursor-grab active:cursor-grabbing"
          />
        )}
      </div>

      <label className="flex items-center gap-3">
        <ZoomIn className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
        <span className="sr-only">Acercar</span>
        <input
          type="range"
          min="1"
          max="3"
          step="0.02"
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
          className="h-11 w-full accent-emerald-600"
        />
      </label>

      <p className="text-center text-xs leading-relaxed text-gray-500">
        Arrastra la foto para mover el encuadre. Se guarda a {shape.width}×{shape.height}.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={crop}
          disabled={busy || !natural}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:bg-gray-200 disabled:text-gray-400"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {busy ? "Subiendo..." : "Usar esta"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="h-12 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-600"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
