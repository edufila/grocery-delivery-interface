"use client"

import { useEffect, useRef, useState } from "react"
import { MessageCircle, Send, X } from "lucide-react"

type Message = {
  id: number
  from: "shopper" | "cliente"
  text: string
  time: string
}

const SEED: Message[] = [
  {
    id: 1,
    from: "shopper",
    text: "¡Hola! Soy Andrés, tu shopper. Ya estoy en el abasto empezando tu compra.",
    time: "3:48 PM",
  },
  {
    id: 2,
    from: "shopper",
    text: "No queda Harina PAN de 1 kg. ¿Te llevo la presentación de 900 g?",
    time: "3:52 PM",
  },
]

function ahora() {
  return new Date().toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit" })
}

export function ShopperChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>(SEED)
  const [draft, setDraft] = useState("")
  const endRef = useRef<HTMLDivElement>(null)

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

  const send = () => {
    const text = draft.trim()
    if (!text) return
    setMessages((prev) => [...prev, { id: prev.length + 1, from: "cliente", text, time: ahora() }])
    setDraft("")
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98]"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        Abrir chat con tu Shopper
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          role="dialog"
          aria-modal="true"
          aria-label="Chat con tu shopper"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-label="Cerrar chat"
          />

          <div className="relative flex h-[80dvh] w-full flex-col rounded-t-3xl bg-white">
            <header className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-5 py-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700">
                A
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">Andrés</p>
                <p className="text-xs text-gray-500">Tu shopper · Gran Abasto Girasol</p>
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

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {messages.map((message) => {
                const mine = message.from === "cliente"
                return (
                  <div key={message.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                        mine
                          ? "rounded-br-md bg-emerald-600 text-white"
                          : "rounded-bl-md bg-gray-100 text-gray-900"
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{message.text}</p>
                      <p
                        className={`mt-1 text-[11px] ${mine ? "text-emerald-100" : "text-gray-400"}`}
                      >
                        {message.time}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>

            <form
              className="flex shrink-0 items-center gap-2 border-t border-gray-100 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
              onSubmit={(event) => {
                event.preventDefault()
                send()
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Escribí tu mensaje..."
                aria-label="Mensaje para tu shopper"
                enterKeyHint="send"
                className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white"
              />
              <button
                type="submit"
                disabled={draft.trim().length === 0}
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
