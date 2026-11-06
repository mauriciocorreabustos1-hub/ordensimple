import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import { Logo } from "@/components/app/logo"
import { SignOutButton } from "@/components/app/user-menu"
import { requireAdmin } from "@/server/admin"

export const metadata: Metadata = {
  title: "Administración",
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="sticky top-safe z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo href="/" />
            <span className="hidden items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary sm:inline-flex">
              <ShieldCheck className="size-3.5" />
              Administración
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/dashboard" className="inline-flex h-9 items-center gap-1.5 px-2.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Volver a mi negocio</span>
              <span className="max-[379px]:sr-only sm:hidden">Volver</span>
            </Link>
            <SignOutButton compact />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  )
}
