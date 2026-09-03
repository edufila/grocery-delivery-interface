import type { Metadata } from "next"

import { LoginView } from "@/components/auth/login-view"
import { pageTitle } from "@/lib/brand"
import { safeNextPath } from "@/lib/safe-path"

export const metadata: Metadata = {
  title: pageTitle("Ingresar"),
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const params = await searchParams

  return <LoginView next={safeNextPath(params.next)} initialError={params.error} />
}
