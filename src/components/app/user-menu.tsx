"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut, Monitor, Moon, Settings, ShieldCheck, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
}

export function useSignOut() {
  const router = useRouter()
  return async () => {
    const { error } = await authClient.signOut()
    if (error) {
      toast.error("No pudimos cerrar tu sesión. Inténtalo de nuevo.")
      return
    }
    toast.success("Cerraste sesión")
    router.replace("/login")
    router.refresh()
  }
}

/** Botón "Cerrar sesión" para usar fuera del menú de perfil. */
export function SignOutButton({ className, compact = false }: { className?: string; compact?: boolean }) {
  const signOut = useSignOut()
  const [pending, setPending] = React.useState(false)
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        await signOut()
        setPending(false)
      }}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg text-sm text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50",
        compact ? "h-9 px-2.5" : "h-9 px-3",
        className,
      )}
    >
      <LogOut className="size-4" />
      {compact ? (
        <>
          <span className="sm:hidden">Salir</span>
          <span className="hidden sm:inline">Cerrar sesión</span>
        </>
      ) : (
        "Cerrar sesión"
      )}
    </button>
  )
}

export function UserMenu({
  name,
  email,
  showDetails = false,
  isAdmin = false,
  hideSignOut = false,
  className,
}: {
  name: string
  email: string
  showDetails?: boolean
  isAdmin?: boolean
  /** En la barra lateral ya hay un botón propio de cerrar sesión. */
  hideSignOut?: boolean
  className?: string
}) {
  const signOut = useSignOut()
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-3 rounded-lg p-1.5 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        aria-label="Menú de perfil"
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">{initials(name)}</AvatarFallback>
        </Avatar>
        {showDetails ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="block truncate text-xs text-muted-foreground">{email}</span>
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={showDetails ? "top" : "bottom"} className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/configuracion">
            <Settings />
            Configuración
          </Link>
        </DropdownMenuItem>
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldCheck />
              Administración
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Tema</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun />
            Claro
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon />
            Oscuro
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor />
            Automático
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        {hideSignOut ? null : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()} variant="destructive">
              <LogOut />
              Cerrar sesión
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
