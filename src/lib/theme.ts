"use client"

import { useSyncExternalStore } from "react"

// Tema claro / oscuro / automático sin dependencias.
// El script de la cabecera (ver THEME_SCRIPT) aplica el tema antes de que se dibuje la página,
// y este módulo lo mantiene sincronizado después (cambios del usuario, del sistema y de otras pestañas).

export type Theme = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

export const THEME_STORAGE_KEY = "theme"

const listeners = new Set<() => void>()
const media = () => window.matchMedia("(prefers-color-scheme: dark)")

function readTheme(): Theme {
  try {
    const t = window.localStorage.getItem(THEME_STORAGE_KEY)
    return t === "light" || t === "dark" ? t : "system"
  } catch {
    return "system"
  }
}

function resolve(theme: Theme): ResolvedTheme {
  if (theme === "system") return media().matches ? "dark" : "light"
  return theme
}

function apply(theme: Theme) {
  const resolved = resolve(theme)
  const root = document.documentElement
  // Evita que todos los colores animen al cambiar de tema.
  const style = document.createElement("style")
  style.textContent = "*,*::before,*::after{transition:none!important}"
  document.head.appendChild(style)
  root.classList.toggle("dark", resolved === "dark")
  root.style.colorScheme = resolved
  window.getComputedStyle(document.body)
  setTimeout(() => style.remove(), 1)
}

function notify() {
  for (const l of listeners) l()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onSystemChange = () => {
    if (readTheme() === "system") apply("system")
    listener()
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) {
      apply(readTheme())
      listener()
    }
  }
  const mq = media()
  mq.addEventListener("change", onSystemChange)
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    mq.removeEventListener("change", onSystemChange)
    window.removeEventListener("storage", onStorage)
  }
}

export function setTheme(theme: Theme) {
  try {
    if (theme === "system") window.localStorage.removeItem(THEME_STORAGE_KEY)
    else window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Almacenamiento bloqueado: el tema se aplica igual en esta visita.
  }
  apply(theme)
  notify()
}

/** Tema elegido y tema efectivo. En el servidor (y al hidratar) se asume "system". */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme)
  const resolvedTheme = useSyncExternalStore(
    subscribe,
    () => resolve(readTheme()),
    () => "light" as ResolvedTheme,
  )
  return { theme, resolvedTheme, setTheme: (t: string) => setTheme(t as Theme) }
}
