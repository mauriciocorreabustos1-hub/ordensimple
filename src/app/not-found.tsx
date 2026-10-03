import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/app/logo"

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <div className="space-y-1">
        <p className="text-5xl font-semibold tracking-tight">404</p>
        <p className="text-muted-foreground">Esta página no existe o fue movida.</p>
      </div>
      <Button asChild>
        <Link href="/">Volver al inicio</Link>
      </Button>
    </div>
  )
}
