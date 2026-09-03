"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, ShoppingBasket } from "lucide-react"

import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

const COUNTRY_CODE = "+58"
const PHONE_LENGTH = 10
const CODE_LENGTH = 6
const RESEND_SECONDS = 60

// Canal del código de un solo uso. Para pasarlo a email (gratis, sin proveedor
// de SMS) hay que cambiar esto a "email" y pedir email en vez de teléfono:
// signInWithOtp({ email }) y verifyOtp({ email, token, type: "email" }).
const OTP_TYPE = "sms" as const

type Step = "phone" | "code"

/** Deja solo dígitos y saca el 0 o el 58 que la gente suele anteponer. */
function normalizePhone(raw: string) {
  let digits = raw.replace(/\D/g, "")
  if (digits.startsWith("58")) digits = digits.slice(2)
  if (digits.startsWith("0")) digits = digits.slice(1)
  return digits.slice(0, PHONE_LENGTH)
}

/** 4141234567 -> "414 123 4567" */
function formatPhone(digits: string) {
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)]
  return parts.filter(Boolean).join(" ")
}

function isValidPhone(digits: string) {
  return digits.length === PHONE_LENGTH && digits.startsWith("4")
}

/** Traduce los errores de Supabase a algo que se entienda. */
function friendlyError(message: string) {
  const m = message.toLowerCase()
  if (m.includes("invalid") && m.includes("token")) return "El código no es correcto. Revisalo e intentá de nuevo."
  if (m.includes("expired")) return "El código venció. Pedí uno nuevo."
  if (m.includes("rate limit") || m.includes("too many")) return "Demasiados intentos. Esperá un momento antes de reintentar."
  if (m.includes("invalid") && m.includes("phone")) return "Ese número no parece válido."
  if (m.includes("sms") || m.includes("provider")) return "No pudimos enviar el SMS. Revisá la configuración del proveedor."
  return "Algo salió mal. Intentá de nuevo en un momento."
}

export function LoginView({ next, initialError }: { next: string; initialError?: string }) {
  const router = useRouter()
  const supabase = useMemo(() => (isSupabaseConfigured ? createClient() : null), [])

  const [step, setStep] = useState<Step>("phone")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [pending, setPending] = useState(false)
  const [googlePending, setGooglePending] = useState(false)
  const [error, setError] = useState(
    initialError === "oauth" ? "No se pudo completar el ingreso con Google. Probá otra vez." : "",
  )
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [codeFocused, setCodeFocused] = useState(false)

  const codeInputRef = useRef<HTMLInputElement>(null)
  const submittedCodeRef = useRef("")

  const e164 = `${COUNTRY_CODE}${phone}`

  // Cuenta regresiva para poder reenviar el código.
  useEffect(() => {
    if (secondsLeft <= 0) return
    const id = setInterval(() => setSecondsLeft((s) => (s <= 1 ? 0 : s - 1)), 1000)
    return () => clearInterval(id)
  }, [secondsLeft])

  // Al llegar al paso del código, enfocamos para que salte el teclado.
  useEffect(() => {
    if (step === "code") codeInputRef.current?.focus()
  }, [step])

  async function requestCode() {
    if (!supabase || pending || !isValidPhone(phone)) return
    setPending(true)
    setError("")

    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: e164 })

    setPending(false)
    if (otpError) {
      setError(friendlyError(otpError.message))
      return
    }

    setCode("")
    submittedCodeRef.current = ""
    setSecondsLeft(RESEND_SECONDS)
    setStep("code")
  }

  async function verifyCode(value: string) {
    if (!supabase || pending || value.length !== CODE_LENGTH) return
    submittedCodeRef.current = value
    setPending(true)
    setError("")

    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: e164,
      token: value,
      type: OTP_TYPE,
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
    // Si sale bien, el navegador ya se está yendo a Google: no reseteamos el estado.
  }

  function onCodeChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, CODE_LENGTH)
    setCode(digits)
    if (error) setError("")
    // Autoenvío al completar los 6 dígitos (incluye el autocompletado del SMS).
    if (digits.length === CODE_LENGTH && digits !== submittedCodeRef.current) {
      void verifyCode(digits)
    }
  }

  if (!isSupabaseConfigured) {
    return <MissingConfigNotice />
  }

  return (
    <main className="flex min-h-dvh flex-col bg-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-4">
        {step === "code" ? (
          <button
            type="button"
            onClick={() => {
              setStep("phone")
              setError("")
              setCode("")
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

        <header className="pt-6">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            {step === "phone" ? "Ingresá a tu cuenta" : "Verificá tu número"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            {step === "phone" ? (
              "Te mandamos un código por SMS para confirmar que sos vos."
            ) : (
              <>
                Enviamos un código de {CODE_LENGTH} dígitos al{" "}
                <span className="font-medium text-gray-900">
                  {COUNTRY_CODE} {formatPhone(phone)}
                </span>
                .
              </>
            )}
          </p>
        </header>

        {step === "phone" ? (
          <form
            className="pt-8"
            onSubmit={(event) => {
              event.preventDefault()
              void requestCode()
            }}
          >
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Número de celular
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10">
              <span className="shrink-0 text-base font-medium text-gray-500">{COUNTRY_CODE}</span>
              <span className="h-6 w-px shrink-0 bg-gray-200" aria-hidden="true" />
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                enterKeyHint="go"
                placeholder="414 123 4567"
                value={formatPhone(phone)}
                onChange={(event) => {
                  setPhone(normalizePhone(event.target.value))
                  if (error) setError("")
                }}
                className="h-14 w-full bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-400"
              />
            </div>

            {error && <ErrorText>{error}</ErrorText>}

            <button
              type="submit"
              disabled={!isValidPhone(phone) || pending}
              className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-semibold text-white transition active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400"
            >
              {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
              {pending ? "Enviando código..." : "Continuar"}
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
        ) : (
          <div className="pt-8">
            <div
              className="relative"
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

            <div className="mt-8 text-center">
              {secondsLeft > 0 ? (
                <p className="text-sm text-gray-400">
                  Podés pedir otro código en {secondsLeft}s
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => void requestCode()}
                  disabled={pending}
                  className="min-h-11 px-4 text-sm font-semibold text-emerald-600 disabled:text-gray-400"
                >
                  Reenviar código
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
          Copiá <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">.env.local.example</code> y
          completá los valores de tu proyecto.
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
