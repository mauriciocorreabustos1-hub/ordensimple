"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { slugProblem } from "@/lib/links"
import { checkLinkSlug, createLinkPage } from "@/server/actions/links"
import { cn } from "@/lib/utils"

/** Primer paso: elegir el nombre de usuario. La página se crea con los datos del negocio y sin publicar. */
export function LinkCreate({ suggested, host, businessName }: { suggested: string; host: string; businessName: string }) {
  const router = useRouter()
  const [value, setValue] = React.useState(suggested)
  const [remote, setRemote] = React.useState<{ slug: string; ok: boolean; message: string } | null>(null)
  const [pending, start] = React.useTransition()
  const clean = value.trim().toLowerCase()
  const local = slugProblem(clean)
  // Primero lo que se revisa aquí mismo; si está bien escrito, lo que respondió el servidor para ese mismo nombre.
  const status = local ? (clean ? { ok: false, message: local } : null) : remote?.slug === clean ? remote : null

  React.useEffect(() => {
    if (local) return
    const t = setTimeout(async () => {
      const r = await checkLinkSlug(clean).catch(() => null)
      if (r) setRemote({ slug: clean, ok: r.ok, message: r.message ?? "" })
    }, 400)
    return () => clearTimeout(t)
  }, [clean, local])

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await createLinkPage(clean)
          if (r.ok) {
            toast.success(r.message)
            router.refresh()
          } else toast.error(r.message)
        })
      }}
    >
      <label htmlFor="lk-slug" className="block text-sm font-medium">
        Elige el nombre de tu página
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl border bg-background pl-3.5 focus-within:ring-3 focus-within:ring-ring/50">
          <span className="shrink-0 text-[15px] text-muted-foreground">{host}</span>
          <Input
            id="lk-slug"
            value={value}
            onChange={(e) => setValue(e.target.value.toLowerCase().replace(/\s+/g, ""))}
            maxLength={30}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
            className="h-10 border-0 bg-transparent pl-0.5 text-[15px] font-semibold shadow-none focus-visible:ring-0"
          />
        </div>
        <Button type="submit" className="h-11 px-5" disabled={pending || !status?.ok}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Crear mi página
        </Button>
      </div>
      <p className={cn("min-h-4 text-xs", status ? (status.ok ? "text-success" : "text-danger") : "text-muted-foreground")}>
        {status?.message ?? `Lo propusimos a partir de “${businessName}”. Lo puedes cambiar después.`}
      </p>
    </form>
  )
}
