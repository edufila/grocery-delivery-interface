import { Check, PackageCheck, ShoppingCart, Truck, Home } from "lucide-react"
import { cn } from "@/lib/utils"
import { ShopperChat } from "./shopper-chat"

type StepState = "done" | "current" | "upcoming"

type Step = {
  title: string
  description: string
  time: string
  icon: React.ElementType
  state: StepState
  showChat?: boolean
}

const steps: Step[] = [
  {
    title: "Pedido confirmado",
    description: "Recibimos tu pedido y lo asignamos a un shopper.",
    time: "3:42 PM",
    icon: PackageCheck,
    state: "done",
  },
  {
    title: "Comprando en el abasto",
    description: "Yefferson está seleccionando tus productos en Gran Abasto Girasol.",
    time: "3:55 PM",
    icon: ShoppingCart,
    state: "current",
    showChat: true,
  },
  {
    title: "En camino a tu dirección",
    description: "Tu pedido saldrá hacia Av. Las Delicias, Urb. El Bosque.",
    time: "Estimado 4:20 PM",
    icon: Truck,
    state: "upcoming",
  },
  {
    title: "Entregado",
    description: "Tu pedido llegará a tu puerta.",
    time: "Estimado 4:35 PM",
    icon: Home,
    state: "upcoming",
  },
]

export function StatusTimeline() {
  return (
    <section aria-label="Estado del pedido" className="rounded-2xl border border-gray-100 bg-white p-5">
      <h2 className="mb-5 text-base font-semibold text-gray-900">Estado del pedido</h2>
      <ol className="relative">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          const Icon = step.icon
          return (
            <li key={step.title} className="relative flex gap-4 pb-6 last:pb-0">
              {/* Connector line */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-[18px] top-9 h-[calc(100%-1rem)] w-0.5",
                    step.state === "done" ? "bg-emerald-500" : "bg-gray-200",
                  )}
                />
              )}

              {/* Icon node */}
              <div
                className={cn(
                  "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  step.state === "done" && "border-emerald-500 bg-emerald-500 text-white",
                  step.state === "current" && "border-emerald-500 bg-white text-emerald-600",
                  step.state === "upcoming" && "border-gray-200 bg-white text-gray-300",
                )}
              >
                {step.state === "current" && (
                  <span className="absolute inset-0 -m-1 animate-ping rounded-full bg-emerald-400/40" />
                )}
                {step.state === "done" ? <Check className="h-4 w-4" strokeWidth={3} /> : <Icon className="h-4 w-4" />}
              </div>

              {/* Content */}
              <div className="flex-1 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      step.state === "upcoming" ? "text-gray-400" : "text-gray-900",
                    )}
                  >
                    {step.title}
                  </p>
                  <span className="shrink-0 text-xs font-medium text-gray-400">{step.time}</span>
                </div>
                <p className={cn("mt-0.5 text-sm", step.state === "upcoming" ? "text-gray-400" : "text-gray-500")}>
                  {step.description}
                </p>

                {step.showChat && <ShopperChat />}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
