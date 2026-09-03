"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, MailCheck, ShoppingBasket } from "lucide-react"

import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

const RESEND_SECONDS = 60
const CODE_LENGTH = 6

type Step = "email" | "sent"

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

/** Traduce los errores de Supabase a algo que se entienda. */
function friendlyError(message: string) {
  const m = message.toLowerCase()
  if (m.includes("invalid") && m.includes("token")) return "El código no es correcto. Revísalo e intenta de nuevo."
  if (m.includes("expired")) return "El código venció. Pide uno nuevo."
  if (m.includes("rate limit") || m.includes("too many") || m.includes("seconds"))
    return "Demasiados intentos. Espera un momento antes de reintentar."
  if (m.includes("invalid") && m.includes("email")) return "Ese correo no parece válido."
  if (m.includes("signups not allowed")) return "Los registros nuevos están deshabilitados en Supabase."
  return "Algo salió mal. Intenta de nuevo en un momento."
}

export function LoginView({ next, initialError }: { next: string; initialError?: string }) {
  const router = useRouter()
  const supabase = useMemo(() => (isSupabaseConfigured ? createClient() : null), [])

  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [codeFocused, setCodeFocused] = useState(false)
  const [pending, setPending] = useState(false)
  const [googlePending, setGooglePending] = useState(false)
  const [error, setError] = useState(
    initialError === "oauth" ? "No se pudo completar el ingreso. Prueba otra vez." : "",
  )
  const [secondsLeft, setSecondsLeft] = useState(0)

  const codeInputRef = useRef<HTMLInputElement>(null)
  const submittedCodeRef = useRef("")

  const cleanEmail = email.trim().toLowerCase()

  useEffect(() => {
    if (secondsLeft <= 0) return
    const id = setInterval(() => setSecondsLeft((s) => (s <= 1 ? 0 : s - 1)), 1000)
    return () => clearInterval(id)
  }, [secondsLeft])

  useEffect(() => {
    if (step === "sent") codeInputRef.current?.focus()
  }, [step])

  async function verifyCode(value: string) {
    if (!supabase || pending || value.length !== CODE_LENGTH) return
    submittedCodeRef.current = value
    setPending(true)
    setError("")

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: value,
      type: "email",
    })

    if (verifyError) {
      setPending(false)
      setError(friendlyError(verifyError.message))
      setCode("")
      submittedCodeRef.current = ""
      codeInputRef.current?.focus()
      return
    }

    router.replace(next)
    router.refresh()
  }

  function onCodeChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, CODE_LENGTH)
    setCode(digits)
    if (error) setError("")
    if (digits.length === CODE_LENGTH && digits !== submittedCodeRef.current) {
      void verifyCode(digits)
    }
  }

  async function sendLink() {
    if (!supabase || pending || !isValidEmail(email)) return
    setPending(true)
    setError("")

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })

    setPending(false)
    if (otpError) {
      setError(friendlyError(otpError.message))
      return
    }

    setCode("")
    submittedCodeRef.current = ""
    setSecondsLeft(RESEND_SECONDS)
    setStep("sent")
  }

  async function signInWithGoogle() {
    if (!supabase || googlePending) return
    setGooglePending(true)
    setError("")

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    })

    if (oauthError) {
      setGooglePending(false)
      setError(friendlyError(oauthError.message))
    }
    // Si sale bien, el navegador ya se está yendo a Google.
  }

  if (!isSupabaseConfigured) {
    return <MissingConfigNotice />
  }

  return (
    <main className="flex min-h-dvh flex-col bg-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-4">
        {step === "sent" ? (
          <button
            type="button"
            onClick={() => {
              setStep("email")
              setError("")
            }}
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-gray-700 active:bg-gray-100"
            aria-label="Volver al paso anterior"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50">
            <ShoppingBasket className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          </span>
        )}

        {step === "email" ? (
          <>
            <header className="pt-6">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                Ingresa a tu cuenta
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Te mandamos un código a tu correo. Sin contraseñas.
              </p>
            </header>

            <form
              className="pt-8"
              onSubmit={(event) => {
                event.preventDefault()
                void sendLink()
              }}
            >
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Correo electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="go"
                placeholder="tunombre@correo.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  if (error) setError("")
                }}
                className="mt-2 h-14 w-full rounded-2xl border border-gray-200 bg-white px-4 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              />

              {error && <ErrorText>{error}</ErrorText>}

              <button
                type="submit"
                disabled={!isValidEmail(email) || pending}
                className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-semibold text-white transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400"
              >
                {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
                {pending ? "Enviando..." : "Continuar"}
              </button>

              <div className="flex items-center gap-4 py-7">
                <span className="h-px flex-1 bg-gray-100" aria-hidden="true" />
                <span className="text-xs font-medium uppercase tracking-wide text-gray-400">o</span>
                <span className="h-px flex-1 bg-gray-100" aria-hidden="true" />
              </div>

              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                disabled={googlePending}
                className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white text-base font-semibold text-gray-900 transition active:scale-[0.99] disabled:opacity-60"
              >
                {googlePending ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-hidden="true" />
                ) : (
                  <GoogleIcon />
                )}
                Continuar con Google
              </button>
            </form>
          </>
        ) : (
          <div className="pt-6">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
              <MailCheck className="h-7 w-7 text-emerald-600" aria-hidden="true" />
            </span>

            <h1 className="pt-6 text-2xl font-semibold tracking-tight text-gray-900">
              Revisa tu correo
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              Lo enviamos a <span className="font-medium text-gray-900">{cleanEmail}</span>. Si trae
              un código, escribilo aquí.
            </p>

            <div
              className="relative mt-6"
              onClick={() => codeInputRef.current?.focus()}
              role="presentation"
            >
              <div className="flex justify-between gap-2">
                {Array.from({ length: CODE_LENGTH }).map((_, index) => {
                  const isActive = codeFocused && index === Math.min(code.length, CODE_LENGTH - 1)
                  return (
                    <div
                      key={index}
                      className={cn(
                        "flex h-14 flex-1 items-center justify-center rounded-2xl border bg-white text-xl font-semibold text-gray-900 transition",
                        isActive ? "border-emerald-500 ring-4 ring-emerald-500/10" : "border-gray-200",
                        error && "border-rose-300",
                      )}
                    >
                      {code[index] ?? ""}
                    </div>
                  )
                })}
              </div>
              <input
                ref={codeInputRef}
                value={code}
                onChange={(event) => onCodeChange(event.target.value)}
                onFocus={() => setCodeFocused(true)}
                onBlur={() => setCodeFocused(false)}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH}
                aria-label={`Código de ${CODE_LENGTH} dígitos`}
                className="absolute inset-0 h-full w-full rounded-2xl bg-transparent text-transparent caret-transparent outline-none"
              />
            </div>

            {error && <ErrorText>{error}</ErrorText>}

            {pending && (
              <p className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Verificando...
              </p>
            )}

            <p className="mt-6 rounded-2xl bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-600">
              ¿El correo trae un enlace en vez de un código? Abrilo, pero{" "}
              <span className="font-semibold">desde este mismo navegador</span>: si lo abres en otro
              dispositivo, el acceso no se completa.
            </p>

            <div className="mt-8 text-center">
              {secondsLeft > 0 ? (
                <p className="text-sm text-gray-400">Puedes pedir otro enlace en {secondsLeft}s</p>
              ) : (
                <button
                  type="button"
                  onClick={() => void sendLink()}
                  disabled={pending}
                  className="min-h-11 px-4 text-sm font-semibold text-emerald-600 disabled:text-gray-400"
                >
                  Reenviar enlace
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="mx-auto w-full max-w-md px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-8">
        <p className="text-center text-xs leading-relaxed text-gray-400">
          Al continuar aceptás los Términos y la Política de Privacidad.
        </p>
      </footer>
    </main>
  )
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-3 text-sm text-rose-600">
      {children}
    </p>
  )
}

function MissingConfigNotice() {
  return (
    <main className="flex min-h-dvh items-center bg-white">
      <div className="mx-auto w-full max-w-md px-5">
        <h1 className="text-xl font-semibold text-gray-900">Falta configurar Supabase</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          El login necesita las variables{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
          en un archivo <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">.env.local</code>.
          Copia <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">.env.local.example</code> y
          completa los valores de tu proyecto.
        </p>
      </div>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.63h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.18-2 3.44-4.96 3.44-8.56Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.03-6.45-4.75H1.7v2.98A11.5 11.5 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.55 14.67a6.9 6.9 0 0 1 0-4.41V7.28H1.7a11.51 11.51 0 0 0 0 10.37l3.85-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.71 1.28 15.1 0 12 0 7.5 0 3.62 2.58 1.7 6.34l3.85 2.98C6.46 6.6 9 4.75 12 4.75Z"
      />
    </svg>
  )
}
