"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, CheckCircle2, CloudOff, ExternalLink, Eye, Loader2, MoreHorizontal, RotateCcw, Smartphone, Upload, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { LinkPageView, type LinkViewData } from "@/components/links/link-page-view"
import { BlockList } from "@/components/links/editor/block-list"
import type { EditorProduct } from "@/components/links/editor/block-forms"
import { DesignPanel } from "@/components/links/editor/design-panel"
import { ProfilePanel } from "@/components/links/editor/profile-panel"
import { SharePanel } from "@/components/links/editor/share-panel"
import { MAX_BLOCKS, proFeaturesUsed, publishProblems, suggestedBlocks, type LinkContent } from "@/lib/links"
import { discardLinkDraft, publishLinkPage, saveLinkDraft, unpublishLinkPage } from "@/server/actions/links"
import { cn } from "@/lib/utils"

type Tab = "bloques" | "diseno" | "perfil" | "compartir"
const TABS: { id: Tab; label: string }[] = [
  { id: "bloques", label: "Bloques" },
  { id: "diseno", label: "Diseño" },
  { id: "perfil", label: "Perfil" },
  { id: "compartir", label: "Compartir" },
]

/** dirty: hay cambios que se guardarán en un momento (sin animación: un ícono girando mientras escribes obliga al navegador a redibujar toda la página en cada cuadro). */
type SaveState = "saved" | "dirty" | "saving" | "offline" | "error"

export function LinksEditor(props: {
  initial: LinkContent
  slug: string
  published: boolean
  /** ¿El borrador tiene cambios que aún no se publican? */
  pendingChanges: boolean
  /** Lo que va antes del nombre en la dirección pública (ej.: https://links.ordensimple.cl/). */
  publicPrefix: string
  /** Lo que va antes del nombre en la dirección del QR (siempre el dominio principal). */
  qrPrefix: string
  products: EditorProduct[]
  bookingUrl: string | null
  storeUrl: string | null
  logoUrl: string | null
  pro: boolean
  today: string
  defaults: { whatsapp: string | null; email: string }
}) {
  const router = useRouter()
  const [content, setContent] = React.useState(props.initial)
  const [slug, setSlug] = React.useState(props.slug)
  const [published, setPublished] = React.useState(props.published)
  const [pending, setPending] = React.useState(props.pendingChanges)
  const [tab, setTab] = React.useState<Tab>("bloques")
  const [openId, setOpenId] = React.useState<string | null>(null)
  const [save, setSave] = React.useState<SaveState>("saved")
  const [busy, startBusy] = React.useTransition()
  const [problems, setProblems] = React.useState<{ title: string; items: string[]; pro?: boolean } | null>(null)
  const [previewOpen, setPreviewOpen] = React.useState(false)

  // ─── Guardado automático ─────────────────────────────────────────────────
  // Se guarda solo, un momento después del último cambio. Si se corta internet, reintenta al volver la conexión.
  const latest = React.useRef(content)
  const savedJson = React.useRef(JSON.stringify(props.initial))
  const inFlight = React.useRef<Promise<void> | null>(null)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = React.useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (inFlight.current) await inFlight.current
    const json = JSON.stringify(latest.current)
    if (json === savedJson.current) return true
    let ok = false
    const run = (async () => {
      setSave("saving")
      try {
        const r = await saveLinkDraft(latest.current)
        if (r.ok) {
          savedJson.current = json
          ok = true
          setSave(JSON.stringify(latest.current) === json ? "saved" : "dirty")
        } else {
          setSave("error")
          toast.error(r.message)
        }
      } catch {
        setSave(navigator.onLine ? "error" : "offline")
      }
    })()
    inFlight.current = run
    await run
    inFlight.current = null
    return ok
  }, [])

  const schedule = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), 800)
  }, [flush])

  const update = React.useCallback(
    (next: LinkContent) => {
      latest.current = next
      setContent(next)
      setPending(true)
      setSave((s) => (s === "offline" ? s : "dirty"))
      schedule()
    },
    [schedule],
  )

  React.useEffect(() => {
    const online = () => void flush()
    // Si queda algo sin guardar, se avisa antes de cerrar la pestaña.
    const leave = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== savedJson.current) e.preventDefault()
    }
    window.addEventListener("online", online)
    window.addEventListener("beforeunload", leave)
    return () => {
      window.removeEventListener("online", online)
      window.removeEventListener("beforeunload", leave)
    }
  }, [flush])

  // Si falló por un error de red, vuelve a intentar cada 5 segundos.
  React.useEffect(() => {
    if (save !== "error" && save !== "offline") return
    const t = setInterval(() => navigator.onLine && void flush(), 5000)
    return () => clearInterval(t)
  }, [save, flush])

  // ─── Acciones ────────────────────────────────────────────────────────────
  function publish() {
    const local = publishProblems(content)
    if (local.length) return setProblems({ title: "Antes de publicar, falta esto", items: local })
    if (!props.pro) {
      const pro = proFeaturesUsed(content)
      if (pro.length) return setProblems({ title: "Estás usando funciones del plan Pro", items: pro.map((p) => p[0].toUpperCase() + p.slice(1)), pro: true })
    }
    startBusy(async () => {
      if (!(await flush())) return void toast.error("No pudimos guardar tus cambios. Revisa tu conexión e inténtalo de nuevo.")
      const r = await publishLinkPage()
      if (r.ok) {
        setPublished(true)
        setPending(false)
        toast.success(r.message)
        router.refresh()
      } else {
        const items = (r.fieldErrors?.problems ?? r.fieldErrors?.pro ?? [r.message]) as string[]
        setProblems({ title: r.fieldErrors?.pro ? "Estás usando funciones del plan Pro" : "Antes de publicar, falta esto", items, pro: Boolean(r.fieldErrors?.pro) })
      }
    })
  }

  function unpublish() {
    startBusy(async () => {
      const r = await unpublishLinkPage()
      if (r.ok) {
        setPublished(false)
        toast.success(r.message)
      } else toast.error(r.message)
    })
  }

  function discard() {
    startBusy(async () => {
      await flush()
      const r = await discardLinkDraft()
      if (r.ok) {
        toast.success(r.message)
        router.refresh()
        // El editor vuelve a cargarse con lo publicado.
        window.location.reload()
      } else toast.error(r.message)
    })
  }

  const publicUrl = `${props.publicPrefix}${slug}`
  const wide = useWide()
  const previewProps = { content, logoUrl: props.logoUrl, bookingUrl: props.bookingUrl, today: props.today, products: props.products }
  const setBlocks = React.useCallback((blocks: LinkContent["blocks"]) => update({ ...latest.current, blocks }), [update])

  const actions = React.useRef({ publish, unpublish, discard })
  React.useLayoutEffect(() => {
    actions.current = { publish, unpublish, discard }
  })
  const onPublish = React.useCallback(() => actions.current.publish(), [])
  const onUnpublish = React.useCallback(() => actions.current.unpublish(), [])
  const onDiscard = React.useCallback(() => actions.current.discard(), [])
  const onTheme = React.useCallback((theme: LinkContent["theme"]) => update({ ...latest.current, theme }), [update])

  const status = !published ? { label: "Sin publicar", tone: "muted" } : pending ? { label: "Publicada, con cambios sin publicar", tone: "warn" } : { label: "Publicada", tone: "ok" }

  return (
    <div className="space-y-5">
      <StatusBar
        label={status.label}
        tone={status.tone}
        save={save}
        published={published}
        pending={pending}
        busy={busy}
        publicUrl={publicUrl}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
        onDiscard={onDiscard}
      />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0">
          <TabBar tab={tab} setTab={setTab} count={content.blocks.length} />
          <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="rounded-2xl rounded-tl-none border bg-card p-4 sm:p-5" data-enter>
            {tab === "bloques" ? (
              <BlockList
                blocks={content.blocks}
                onChange={setBlocks}
                products={props.products}
                bookingUrl={props.bookingUrl}
                storeUrl={props.storeUrl}
                pro={props.pro}
                defaults={props.defaults}
                openId={openId}
                setOpenId={setOpenId}
              />
            ) : tab === "diseno" ? (
              <DesignPanel
                theme={content.theme}
                onChange={onTheme}
                pro={props.pro}
                canSuggest={content.blocks.length + 5 <= MAX_BLOCKS}
                onSuggestBlocks={(id) => {
                  update({ ...content, blocks: [...content.blocks, ...suggestedBlocks(id)] })
                  setTab("bloques")
                  toast.success("Agregamos bloques de ejemplo al final. Cámbialos con tus datos antes de publicar.")
                }}
              />
            ) : tab === "perfil" ? (
              <ProfilePanel content={content} onChange={update} hasLogo={Boolean(props.logoUrl)} pro={props.pro} />
            ) : (
              <SharePanel
                slug={slug}
                publicUrl={publicUrl}
                qrUrl={`${props.qrPrefix}${slug}?src=qr`}
                host={props.publicPrefix.replace(/^https?:\/\//, "")}
                published={published}
                logoSrc={content.profile.avatar ? `/l/i/${content.profile.avatar}` : props.logoUrl}
                name={content.profile.name}
                onSlugChanged={(s) => {
                  setSlug(s)
                  router.refresh()
                }}
              />
            )}
          </div>
        </div>

        {/* Vista previa en un celular, siempre a la vista en pantallas grandes. */}
        <aside className="sticky top-16 hidden lg:block" aria-label="Vista previa">
          <PhoneFrame>{wide ? <Preview {...previewProps} /> : null}</PhoneFrame>
          <p className="mt-3 text-center text-xs text-muted-foreground">Vista previa. Los cambios se ven aquí al tiro y en internet cuando publicas.</p>
        </aside>
      </div>

      {/* En el celular, la vista previa se abre con un botón. */}
      <Button onClick={() => setPreviewOpen(true)} className="fixed right-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-40 h-11 rounded-full px-4 shadow-lg lg:hidden">
        <Smartphone /> Ver cómo queda
      </Button>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="h-[92dvh] max-w-[440px] gap-0 overflow-hidden p-0" aria-describedby={undefined}>
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Eye className="size-4" /> Vista previa
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {previewOpen ? <Preview {...previewProps} /> : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(problems)} onOpenChange={(o) => !o && setProblems(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600" /> {problems?.title}
            </DialogTitle>
            <DialogDescription>{problems?.pro ? "Tu plan Gratis no los incluye. Quítalos o pásate a Pro para publicar con ellos." : "Corrige esto y vuelve a publicar. Tus cambios ya están guardados."}</DialogDescription>
          </DialogHeader>
          <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto text-sm">
            {problems?.items.map((p) => (
              <li key={p} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-500" />
                {p}
              </li>
            ))}
          </ul>
          <DialogFooter>
            {problems?.pro ? (
              <Button variant="outline" asChild>
                <a href="/dashboard/plan">Ver el plan Pro</a>
              </Button>
            ) : null}
            <Button onClick={() => setProblems(null)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "dirty")
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground" role="status">
        <span aria-hidden className="size-1.5 rounded-full bg-amber-500" /> Cambios por guardar
      </span>
    )
  if (state === "saving")
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground" role="status">
        <Loader2 className="size-3.5 animate-spin" /> Guardando…
      </span>
    )
  if (state === "offline" || state === "error")
    return (
      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400" role="status">
        <CloudOff className="size-3.5" /> {state === "offline" ? "Sin conexión. Guardaremos al volver" : "No se pudo guardar. Reintentando…"}
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground" role="status">
      <CheckCircle2 className="size-3.5 text-success" /> Guardado
    </span>
  )
}

/** Un celular dibujado: la página se ve con el ancho real de un teléfono y se desliza por dentro. */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[380px] rounded-[2.6rem] border border-black/10 bg-[#101513] p-2.5 shadow-[0_30px_60px_-30px_rgb(0_40_30/0.45)] dark:border-white/10">
      <div className="relative h-[min(760px,calc(100dvh-9rem))] overflow-hidden rounded-[2.1rem] bg-white">
        <span aria-hidden className="absolute top-2 left-1/2 z-10 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-[#101513]" />
        <div className="h-full overflow-y-auto overscroll-contain [scrollbar-width:none]">{children}</div>
      </div>
    </div>
  )
}

/** ¿Pantalla grande (donde la vista previa queda siempre a la vista)? */
function useWide() {
  return React.useSyncExternalStore(
    (cb) => {
      const m = matchMedia("(min-width: 1024px)")
      m.addEventListener("change", cb)
      return () => m.removeEventListener("change", cb)
    },
    () => matchMedia("(min-width: 1024px)").matches,
    () => false,
  )
}

type StatusBarProps = {
  label: string
  tone: string
  save: SaveState
  published: boolean
  pending: boolean
  busy: boolean
  publicUrl: string
  onPublish: () => void
  onUnpublish: () => void
  onDiscard: () => void
}

/** Barra de estado: si está publicada, si se guardó y las acciones principales. No se redibuja al escribir. */
const StatusBar = React.memo(function StatusBar({ label, tone, save, published, pending, busy, publicUrl, onPublish, onUnpublish, onDiscard }: StatusBarProps) {
  return (
    <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background/90 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-8 lg:px-8">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className={cn("size-2 rounded-full", tone === "ok" ? "bg-success" : tone === "warn" ? "bg-amber-500" : "bg-muted-foreground/50")} />
          {label}
        </span>
        <SaveIndicator state={save} />
      </div>
      <div className="flex items-center gap-1.5">
        {published ? (
          <Button variant="ghost" size="sm" asChild>
            <a href={publicUrl} target="_blank" rel="noopener">
              <ExternalLink /> <span className="max-sm:sr-only">Ver página</span>
            </a>
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Más opciones de publicación">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={!published || !pending || busy} onClick={onDiscard}>
              <RotateCcw /> Descartar cambios sin publicar
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!published || busy} onClick={onUnpublish}>
              <EyeOff /> Dejar de publicar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button onClick={onPublish} disabled={busy || (published && !pending)} className="h-9 px-3.5">
          {busy ? <Loader2 className="animate-spin" /> : <Upload />}
          {published ? (pending ? "Publicar cambios" : "Al día") : "Publicar"}
        </Button>
      </div>
    </div>
  )
})

/** Pestañas de archivador: la abierta queda pegada a la hoja de abajo. */
const TabBar = React.memo(function TabBar({ tab, setTab, count }: { tab: Tab; setTab: (t: Tab) => void; count: number }) {
  return (
    <div role="tablist" aria-label="Partes del editor" className="flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
      {TABS.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          id={`tab-${t.id}`}
          aria-selected={tab === t.id}
          aria-controls={`panel-${t.id}`}
          onClick={() => setTab(t.id)}
          className={cn(
            "relative top-px shrink-0 rounded-t-xl border border-b-0 px-3 pt-2 pb-2 text-sm font-medium transition-colors sm:px-4",
            tab === t.id ? "z-10 bg-card text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
          {t.id === "bloques" ? <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{count}</span> : null}
        </button>
      ))}
    </div>
  )
})

/**
 * La vista previa, en segundo plano: lo que escribes aparece al tiro y el celular dibujado se pone al día apenas haces
 * una pausa. Solo esta parte se vuelve a dibujar, no todo el editor.
 */
const Preview = React.memo(function Preview({
  content,
  logoUrl,
  bookingUrl,
  today,
  products,
}: {
  content: LinkContent
  logoUrl: string | null
  bookingUrl: string | null
  today: string
  products: EditorProduct[]
}) {
  // Se pone al día cuando paras de escribir un instante (no letra por letra): así no compite con lo que escribes.
  const [deferred, setDeferred] = React.useState(content)
  React.useEffect(() => {
    if (content === deferred) return
    const t = setTimeout(() => setDeferred(content), 180)
    return () => clearTimeout(t)
  }, [content, deferred])
  return React.useMemo(() => {
    const data: LinkViewData = {
      content: deferred,
      logoUrl,
      bookingUrl,
      today,
      preview: true,
      products: Object.fromEntries(
        deferred.blocks.flatMap((b) => (b.type === "products" ? [[b.id, b.productIds.flatMap((id) => products.filter((p) => p.id === id).map((p) => ({ ...p, href: null })))]] : [])),
      ),
    }
    return <LinkPageView data={data} className="min-h-full" />
  }, [deferred, logoUrl, bookingUrl, today, products])
})
