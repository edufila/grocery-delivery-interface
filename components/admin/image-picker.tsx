"use client"

import { useEffect, useRef, useState } from "react"
import { ImageUp, Loader2, Trash2, X } from "lucide-react"

import { ImageCropper, type CropShape } from "@/components/admin/image-cropper"
import { createClient } from "@/lib/supabase/client"

const BUCKET = "fotos"

/**
 * Con qué forma se guarda cada tipo de foto. La tarjeta de la tienda es
 * apaisada, el producto cuadrado y la cara redonda: si no se recorta a la
 * proporción correcta, el navegador la recorta solo por el centro y suele
 * dejar afuera lo que importa.
 */
const SHAPES: Record<string, CropShape> = {
  tiendas: { width: 900, height: 506 },
  productos: { width: 500, height: 500 },
  shoppers: { width: 300, height: 300, round: true },
}

type Stored = { name: string; url: string }

/**
 * Sube y elige fotos del bucket. Redimensiona en el navegador antes de subir:
 * la optimización de imágenes de Next está apagada, así que lo que se sube es
 * exactamente lo que descarga el cliente.
 */
export function ImagePicker({
  folder,
  value,
  onChange,
}: {
  folder: "tiendas" | "productos" | "shoppers"
  value: string
  onChange: (url: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<Stored[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [pending, setPending] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const shape = SHAPES[folder]

  useEffect(() => {
    if (!open) return
    let cancelled = false

    void (async () => {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase.storage.from(BUCKET).list(folder, {
        limit: 200,
        sortBy: { column: "created_at", order: "desc" },
      })
      if (cancelled) return

      setFiles(
        (data ?? [])
          .filter((f) => f.name !== ".emptyFolderPlaceholder")
          .map((f) => ({
            name: f.name,
            url: supabase.storage.from(BUCKET).getPublicUrl(`${folder}/${f.name}`).data.publicUrl,
          })),
      )
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [open, folder])

  async function upload(blob: Blob, sourceName: string) {
    setBusy(true)
    setError("")

    try {
      const clean = sourceName
        .toLowerCase()
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40)
      const path = `${folder}/${Date.now()}-${clean}.webp`

      const supabase = createClient()
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: "image/webp", upsert: false })

      if (uploadError) {
        setError(
          uploadError.message.includes("Bucket not found")
            ? "Falta crear el bucket de fotos en Supabase."
            : "No pudimos subirla. ¿Tu rol sigue siendo admin o dev?",
        )
        setBusy(false)
        return
      }

      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
      setFiles((prev) => [{ name: path.split("/")[1], url }, ...prev])
      onChange(url)
      setPending(null)
      setOpen(false)
    } catch {
      setError("No pudimos procesar esa imagen.")
    }

    setBusy(false)
  }

  async function remove(name: string) {
    setBusy(true)
    await createClient().storage.from(BUCKET).remove([`${folder}/${name}`])
    setFiles((prev) => prev.filter((f) => f.name !== name))
    setBusy(false)
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        {value ? (
          <img
            src={value}
            alt=""
            className="h-11 w-11 shrink-0 rounded-lg bg-gray-100 object-cover"
          />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[10px] text-gray-400">
            sin foto
          </span>
        )}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Ruta o URL de la foto"
          aria-label="Foto"
          className="h-11 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-700 active:bg-gray-50"
        >
          <ImageUp className="h-4 w-4" aria-hidden="true" />
          Elegir
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
          />
          <div className="relative flex max-h-[85dvh] w-full flex-col rounded-t-3xl bg-white">
            <div className="flex shrink-0 items-center justify-between px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Fotos de {folder}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5">
              {pending ? (
                <div className="pb-4">
                  <ImageCropper
                    file={pending}
                    shape={shape}
                    busy={busy}
                    onCancel={() => setPending(null)}
                    onDone={(blob) => void upload(blob, pending.name)}
                  />
                  {error && (
                    <p role="alert" className="mt-2 text-sm text-rose-600">
                      {error}
                    </p>
                  )}
                </div>
              ) : loading ? (
                <p className="py-8 text-center text-sm text-gray-400">Cargando...</p>
              ) : files.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  Todavía no hay fotos aquí. Sube la primera.
                </p>
              ) : (
                <ul className="grid grid-cols-3 gap-2 pb-2 sm:grid-cols-4">
                  {files.map((file) => (
                    <li key={file.name} className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          onChange(file.url)
                          setOpen(false)
                        }}
                        className={`block w-full overflow-hidden rounded-xl border-2 ${
                          value === file.url ? "border-emerald-500" : "border-transparent"
                        }`}
                      >
                        <img
                          src={file.url}
                          alt={file.name}
                          className="aspect-square w-full bg-gray-50 object-cover"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(file.name)}
                        disabled={busy}
                        className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-500 backdrop-blur active:text-rose-600"
                        aria-label={`Borrar ${file.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {error && !pending && (
                <p role="alert" className="py-2 text-sm text-rose-600">
                  {error}
                </p>
              )}
            </div>

            <div
              className={`shrink-0 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 ${
                pending ? "hidden" : ""
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    setError("")
                    setPending(file)
                  }
                  event.target.value = ""
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:bg-gray-200 disabled:text-gray-400"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ImageUp className="h-4 w-4" aria-hidden="true" />
                )}
                {busy ? "Subiendo..." : "Subir una foto"}
              </button>
              <p className="mt-2 text-center text-xs text-gray-500">
                Vas a poder encuadrarla antes de subirla.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
