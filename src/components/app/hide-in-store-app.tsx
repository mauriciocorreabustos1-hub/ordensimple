"use client"

import * as React from "react"
import { APP_USER_AGENT } from "@/lib/native-app"

const noSubscribe = () => () => {}

/** Lo que invita a contratar un plan no se muestra en las apps de App Store y Google Play (exigen su sistema de pago). */
export function HideInStoreApp({ children }: { children: React.ReactNode }) {
  const inApp = React.useSyncExternalStore(noSubscribe, () => navigator.userAgent.includes(APP_USER_AGENT), () => false)
  return inApp ? null : <>{children}</>
}
