import type { Metadata } from "next"

import { LoginView } from "@/components/auth/login-view"
import { safeNextPath } from "@/lib/safe-path"

export const metadata: Metadata = {
  title: "Ingresar · Gran Abasto Girasol",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const params = await searchParams

  return <LoginView next={safeNextPath(params.next)} initialError={params.error} />
}
