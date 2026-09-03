"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { MessageCircle, Send, X } from "lucide-react"

import { createClient } from "@/lib/supabase/client"

type Message = {
  id: string
  sender_id: string
  body: string
  created_at: string
}

/**
 * Chat entre el cliente y el shopper de un pedido. Los mensajes viven en la
 * base y llegan por Realtime: antes existían solo en la pantalla de quien los
 * escribea, así que el otro nunca los veía.
 */
export function OrderChat({
  orderId,
  userId,
  title,
  subtitle,
}: {
  orderId: string
  userId: string
  title: string
  subtitle: string
}) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [unread, setUnread] = useState(0)
  const endRef = useRef<HTMLDivElement>(null)
  const openRef = useRef(false)

  useEffect(() => {
    openRef.current = open
    if (open) setUnread(0)
  }, [open])

  const load = useCallback(async () => {
    const { data } = await createClient()
      .from("order_messages")
      .select("id, sender_id, body, created_at")
      .eq("order_id", orderId)
      .order("created_at")
      .returns<Message[]>()
    setMessages(data ?? [])
  }, [orderId])

  useEffect(() => {
    void load()

    const supabase = createClient()
    const channel = supabase
      .channel(`chat-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_messages",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          const message = payload.new as Message
          setMessages((prev) =>
            prev.some((m) => m.id === message.id) ? prev : [...prev, message],
          )
          // Con el chat cerrado, avisamos con un punto en el botón.
          if (!openRef.current && message.sender_id !== userId) {
            setUnread((n) => n + 1)
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [orderId, userId, load])

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" })
  }, [open, messages])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  async function send() {
    const body = draft.trim()
    if (!body || sending) return

    setSending(true)
    setError("")

    const { error: sendError } = await createClient()
      .from("order_messages")
      .insert({ order_id: orderId, sender_id: userId, body })

    setSending(false)

    if (sendError) {
      setError(
        sendError.message.includes("does not exist")
          ? "Falta correr la migración del chat en Supabase."
          : "No se pudo enviar. Prueba de nuevo.",
      )
      return
    }

    setDraft("")
    // Si Realtime no está habilitado, al menos el propio mensaje aparece.
    void load()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98]"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        {title}
        {unread > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-emerald-700">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-label="Cerrar chat"
          />

          <div className="relative flex h-[80dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white">
            <header className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{title}</p>
                <p className="truncate text-xs text-gray-500">{subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
              {messages.length === 0 && (
                <p className="py-8 text-center text-sm leading-relaxed text-gray-400">
                  Todavía no hay mensajes. Escribe aquí si hace falta coordinar algo del pedido.
                </p>
              )}

              {messages.map((message) => {
                const mine = message.sender_id === userId
                return (
                  <div key={message.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                        mine
                          ? "rounded-br-md bg-emerald-600 text-white"
                          : "rounded-bl-md bg-gray-100 text-gray-900"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {message.body}
                      </p>
                      <p className={`mt-1 text-[11px] ${mine ? "text-emerald-100" : "text-gray-400"}`}>
                        {new Date(message.created_at).toLocaleTimeString("es-VE", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>

            {error && (
              <p role="alert" className="shrink-0 px-5 pb-2 text-sm text-rose-600">
                {error}
              </p>
            )}

            <form
              className="flex shrink-0 items-center gap-2 border-t border-gray-100 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
              onSubmit={(event) => {
                event.preventDefault()
                void send()
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Escribe tu mensaje..."
                aria-label="Mensaje"
                enterKeyHint="send"
                maxLength={1000}
                className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white"
              />
              <button
                type="submit"
                disabled={draft.trim().length === 0 || sending}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white transition active:scale-95 disabled:bg-gray-200 disabled:text-gray-400"
                aria-label="Enviar mensaje"
              >
                <Send className="h-5 w-5" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
