"use client"

import * as React from "react"
import Link from "next/link"
import { useSession } from "@/lib/auth-client"

/**
 * Enlace para crear la cuenta. Si la persona ya inició sesión, la lleva directo adentro (a `inApp`) en vez de
 * pasar por "Crear cuenta" y rebotar al panel.
 */
export function SignupLink({
  children,
  inApp = "/dashboard",
  loggedInLabel,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "href"> & { inApp?: string; loggedInLabel?: React.ReactNode }) {
  const { data: session } = useSession()
  const loggedIn = Boolean(session)
  return (
    <Link {...props} href={loggedIn ? inApp : "/registro"}>
      {loggedIn && loggedInLabel ? loggedInLabel : children}
    </Link>
  )
}
