"use client"

import * as React from "react"
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Image as ImageIcon,
  Link2,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Minus,
  ShoppingBag,
  Tag,
  Trash2,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { SocialIcon } from "@/components/links/social-icons"
import { BlockForm, type EditorProduct } from "@/components/links/editor/block-forms"
import { Field, ProTag } from "@/components/links/editor/fields"
import { BLOCK_INFO, blockProblem, FREE_MAX_BLOCKS, MAX_BLOCKS, newBlockId, type LinkBlock, type LinkBlockType } from "@/lib/links"
import { cn } from "@/lib/utils"

const TYPE_ICON: Record<LinkBlockType, LucideIcon> = {
  link: Link2,
  text: AlignLeft,
  image: ImageIcon,
  video: Video,
  socials: Users,
  whatsapp: Phone,
  email: Mail,
  phone: Phone,
  location: MapPin,
  separator: Minus,
  products: ShoppingBag,
  booking: CalendarDays,
  quote: FileText,
  promo: Tag,
}

function TypeIcon({ type, className }: { type: LinkBlockType; className?: string }) {
  if (type === "whatsapp") return <SocialIcon kind="whatsapp" className={className} />
  const Icon = TYPE_ICON[type]
  return <Icon className={className} />
}

/** Bloque nuevo y vacío del tipo elegido. */
export function emptyBlock(type: LinkBlockType, d: { whatsapp: string | null; email: string }): LinkBlock {
  const base = { id: newBlockId(), hidden: false, startsAt: null, endsAt: null }
  switch (type) {
    case "link":
      return { ...base, type, title: "", url: "", icon: null, thumb: null }
    case "text":
      return { ...base, type, title: "", body: "" }
    case "image":
      return { ...base, type, image: null, alt: "", url: "", ratio: "auto" }
    case "video":
      return { ...base, type, url: "", title: "" }
    case "socials":
      return { ...base, type, items: [{ kind: "instagram", handle: "" }] }
    case "whatsapp":
      return { ...base, type, title: "Escríbenos por WhatsApp", phone: d.whatsapp ?? "", message: "" }
    case "email":
      return { ...base, type, title: "Escríbenos un correo", email: d.email, subject: "" }
    case "phone":
      return { ...base, type, title: "Llámanos", phone: d.whatsapp ?? "" }
    case "location":
      return { ...base, type, title: "Cómo llegar", address: "" }
    case "separator":
      return { ...base, type, style: "line" }
    case "products":
      return { ...base, type, title: "", productIds: [], layout: "grid" }
    case "booking":
      return { ...base, type, title: "Reserva tu hora" }
    case "quote":
      return { ...base, type, title: "Pide una cotización", channel: "whatsapp", phone: d.whatsapp ?? "", email: d.email, message: "" }
    case "promo":
      return { ...base, type, title: "", body: "", code: "", url: "", until: null }
  }
}

/** Una línea que dice qué tiene el bloque, para reconocerlo en la lista sin abrirlo. */
function summary(b: LinkBlock, products: EditorProduct[]) {
  switch (b.type) {
    case "link":
      return b.title || b.url || "Sin texto"
    case "text":
      return b.title || b.body.slice(0, 60) || "Sin texto"
    case "image":
      return b.alt || (b.image ? "Foto" : "Sin foto")
    case "video":
      return b.title || b.url || "Sin video"
    case "socials":
      return b.items.map((i) => i.kind[0].toUpperCase() + i.kind.slice(1)).join(", ") || "Sin redes"
    case "whatsapp":
    case "phone":
      return b.phone || b.title
    case "email":
      return b.email || b.title
    case "location":
      return b.address || "Sin dirección"
    case "separator":
      return b.style === "line" ? "Línea" : b.style === "dots" ? "Puntos" : "Espacio"
    case "products": {
      const names = b.productIds.map((id) => products.find((p) => p.id === id)?.name).filter(Boolean)
      return names.length ? `${names.length} · ${names.slice(0, 2).join(", ")}${names.length > 2 ? "…" : ""}` : "Sin productos"
    }
    case "booking":
    case "quote":
      return b.title
    case "promo":
      return b.title || "Sin título"
  }
}

export function BlockList({
  blocks,
  onChange,
  products,
  bookingUrl,
  storeUrl,
  pro,
  defaults,
  openId,
  setOpenId,
}: {
  blocks: LinkBlock[]
  onChange: (blocks: LinkBlock[]) => void
  products: EditorProduct[]
  bookingUrl: string | null
  storeUrl: string | null
  pro: boolean
  defaults: { whatsapp: string | null; email: string }
  openId: string | null
  setOpenId: (id: string | null) => void
}) {
  const [adding, setAdding] = React.useState(false)
  const [armed, setArmed] = React.useState<string | null>(null)
  const [dragging, setDragging] = React.useState<string | null>(null)

  // Las acciones leen siempre la lista más reciente, pero no cambian entre una tecla y otra: así cada fila se
  // vuelve a dibujar solo cuando cambia su propio bloque (escribir no redibuja toda la lista).
  const latest = React.useRef({ blocks, onChange, setOpenId })
  React.useLayoutEffect(() => {
    latest.current = { blocks, onChange, setOpenId }
  })
  const actions = React.useMemo<RowActions>(() => {
    const move = (from: number, to: number) => {
      const { blocks, onChange } = latest.current
      if (from < 0 || to < 0 || to >= blocks.length || from === to) return
      const next = [...blocks]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      onChange(next)
    }
    return {
      update: (id, next) => latest.current.onChange(latest.current.blocks.map((b) => (b.id === id ? next : b))),
      move,
      duplicate: (i) => {
        const { blocks, onChange } = latest.current
        if (blocks.length >= MAX_BLOCKS) return
        const next = [...blocks]
        next.splice(i + 1, 0, { ...structuredClone(blocks[i]), id: newBlockId() })
        onChange(next)
      },
      remove: (id) => latest.current.onChange(latest.current.blocks.filter((x) => x.id !== id)),
      toggle: (id, open) => latest.current.setOpenId(open ? null : id),
      arm: setArmed,
      dragStart: setDragging,
      dragOver: (overIndex, dragId) => move(latest.current.blocks.findIndex((x) => x.id === dragId), overIndex),
      dragEnd: () => {
        setDragging(null)
        setArmed(null)
      },
    }
  }, [])

  const add = (type: LinkBlockType) => {
    const block = emptyBlock(type, defaults)
    onChange([...blocks, block])
    setOpenId(block.id)
    setAdding(false)
    // Que se vea el bloque recién agregado.
    requestAnimationFrame(() => document.getElementById(`blk-${block.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }))
  }
  const visible = blocks.filter((b) => !b.hidden).length

  return (
    <div className="space-y-3">
      {blocks.length ? (
        <ol className="space-y-2" aria-label="Bloques de tu página, en orden">
          {blocks.map((b, i) => (
            <BlockRow
              key={b.id}
              block={b}
              index={i}
              count={blocks.length}
              open={openId === b.id}
              armed={armed === b.id}
              dragging={dragging}
              pro={pro}
              products={products}
              bookingUrl={bookingUrl}
              storeUrl={storeUrl}
              actions={actions}
            />
          ))}
        </ol>
      ) : (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center">
          <p className="font-medium">Tu página todavía no tiene bloques</p>
          <p className="mt-1 text-sm text-muted-foreground">Empieza con un enlace, tu WhatsApp o tus redes.</p>
        </div>
      )}

      <Button type="button" variant="outline" className="h-11 w-full border-dashed" onClick={() => setAdding(true)} disabled={blocks.length >= MAX_BLOCKS}>
        <Plus /> Agregar bloque
      </Button>
      {!pro && visible > FREE_MAX_BLOCKS ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">En el plan Gratis se muestran hasta {FREE_MAX_BLOCKS} bloques. Oculta algunos o pásate a Pro.</p>
      ) : null}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Agregar bloque</DialogTitle>
            <DialogDescription>Elige qué quieres sumar a tu página. Después lo puedes mover, ocultar o borrar.</DialogDescription>
          </DialogHeader>
          <BlockPicker onPick={add} pro={pro} bookingUrl={bookingUrl} hasProducts={products.length > 0} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

type RowActions = {
  update: (id: string, next: LinkBlock) => void
  move: (from: number, to: number) => void
  duplicate: (index: number) => void
  remove: (id: string) => void
  toggle: (id: string, open: boolean) => void
  arm: (id: string | null) => void
  dragStart: (id: string) => void
  dragOver: (overIndex: number, dragId: string) => void
  dragEnd: () => void
}

/** Una fila de la lista. Memorizada: solo se redibuja si cambia su bloque, su posición o si está abierta. */
const BlockRow = React.memo(function BlockRow({
  block: b,
  index: i,
  count,
  open,
  armed,
  dragging,
  pro,
  products,
  bookingUrl,
  storeUrl,
  actions,
}: {
  block: LinkBlock
  index: number
  count: number
  open: boolean
  armed: boolean
  dragging: string | null
  pro: boolean
  products: EditorProduct[]
  bookingUrl: string | null
  storeUrl: string | null
  actions: RowActions
}) {
  const problem = b.demo ? "De ejemplo: cámbialo con tus datos o bórralo" : blockProblem(b)
  const scheduled = b.startsAt || b.endsAt
  const ctx = React.useMemo(() => ({ products, bookingUrl, storeUrl }), [products, bookingUrl, storeUrl])
  const onChange = React.useCallback((next: LinkBlock) => actions.update(b.id, next), [actions, b.id])
  return (
    <li
      id={`blk-${b.id}`}
      draggable={armed}
      onDragStart={(e) => {
        actions.dragStart(b.id)
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/plain", b.id)
      }}
      onDragOver={(e) => {
        if (!dragging || dragging === b.id) return
        e.preventDefault()
        actions.dragOver(i, dragging)
      }}
      onDragEnd={actions.dragEnd}
      className={cn(
        "rounded-xl border bg-card transition-shadow",
        open && "shadow-[0_6px_20px_-12px_rgb(0_40_30/0.35)] ring-1 ring-primary/25",
        dragging === b.id && "opacity-50",
        b.hidden && "bg-muted/40",
      )}
    >
      <div className="flex items-center gap-1 py-1.5 pr-1.5 pl-1">
        <button
          type="button"
          aria-label="Arrastra para mover"
          title="Arrastra para mover"
          onPointerDown={() => actions.arm(b.id)}
          onPointerUp={() => actions.arm(null)}
          className="hidden h-9 w-6 shrink-0 cursor-grab touch-none place-items-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing sm:grid"
        >
          <GripVertical className="size-4" />
        </button>
        <button type="button" onClick={() => actions.toggle(b.id, open)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1 text-left">
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", b.hidden ? "bg-muted text-muted-foreground" : "bg-primary/[0.09] text-primary")}>
            <TypeIcon type={b.type} className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold">
              {BLOCK_INFO[b.type].label}
              {BLOCK_INFO[b.type].pro && !pro ? <ProTag /> : null}
              {b.hidden ? <span className="text-[11px] font-normal text-muted-foreground">Oculto</span> : null}
              {scheduled && !b.hidden ? <CalendarClock className="size-3.5 text-muted-foreground" aria-label="Con fechas" /> : null}
            </span>
            <span className={cn("block truncate text-xs", problem && !b.hidden ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
              {problem && !b.hidden ? problem : summary(b, products)}
            </span>
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
        <Button type="button" variant="ghost" size="icon" onClick={() => actions.update(b.id, { ...b, hidden: !b.hidden })} aria-label={b.hidden ? "Mostrar bloque" : "Ocultar bloque"} title={b.hidden ? "Mostrar" : "Ocultar"}>
          {b.hidden ? <EyeOff /> : <Eye />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Más acciones del bloque">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={i === 0} onClick={() => actions.move(i, i - 1)}>
              <ArrowUp /> Subir
            </DropdownMenuItem>
            <DropdownMenuItem disabled={i === count - 1} onClick={() => actions.move(i, i + 1)}>
              <ArrowDown /> Bajar
            </DropdownMenuItem>
            <DropdownMenuItem disabled={count >= MAX_BLOCKS} onClick={() => actions.duplicate(i)}>
              <Copy /> Duplicar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => actions.remove(b.id)}>
              <Trash2 /> Borrar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* En el celular no se puede arrastrar: subir y bajar quedan a mano. */}
      <div className="flex gap-1 px-2 pb-1.5 sm:hidden">
        <Button type="button" variant="ghost" size="xs" disabled={i === 0} onClick={() => actions.move(i, i - 1)}>
          <ArrowUp /> Subir
        </Button>
        <Button type="button" variant="ghost" size="xs" disabled={i === count - 1} onClick={() => actions.move(i, i + 1)}>
          <ArrowDown /> Bajar
        </Button>
      </div>
      {open ? (
        <div className="space-y-4 border-t px-4 pt-4 pb-4">
          <BlockForm block={b} onChange={onChange} ctx={ctx} />
          <Schedule block={b} onChange={onChange} />
        </div>
      ) : null}
    </li>
  )
})

function BlockPicker({ onPick, pro, bookingUrl, hasProducts }: { onPick: (t: LinkBlockType) => void; pro: boolean; bookingUrl: string | null; hasProducts: boolean }) {
  const groups: { title: string; types: LinkBlockType[] }[] = [
    { title: "Contacto y enlaces", types: ["link", "whatsapp", "socials", "phone", "email", "location"] },
    { title: "Contenido", types: ["text", "image", "video", "separator"] },
    { title: "Para vender, con tu OrdenSimple", types: ["products", "booking", "promo", "quote"] },
  ]
  const note = (t: LinkBlockType) => (t === "booking" && !bookingUrl ? "Necesita la tienda online y la Agenda" : t === "products" && !hasProducts ? "Primero agrega productos con precio" : null)
  return (
    <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
      {groups.map((g) => (
        <section key={g.title} className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">{g.title}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {g.types.map((t) => (
              <button key={t} type="button" onClick={() => onPick(t)} className="flex items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.04]">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/[0.09] text-primary">
                  <TypeIcon type={t} className="size-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    {BLOCK_INFO[t].label}
                    {BLOCK_INFO[t].pro && !pro ? <ProTag /> : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">{note(t) ?? BLOCK_INFO[t].hint}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function Schedule({ block, onChange }: { block: LinkBlock; onChange: (b: LinkBlock) => void }) {
  const [open, setOpen] = React.useState(Boolean(block.startsAt || block.endsAt))
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <CalendarClock className="size-3.5" /> Mostrar solo entre ciertas fechas
      </button>
    )
  }
  return (
    <div className="space-y-2 rounded-lg bg-muted/50 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium">
        <CalendarClock className="size-3.5" /> Se muestra solo entre estas fechas
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Desde">
          <Input type="date" value={block.startsAt ?? ""} onChange={(e) => onChange({ ...block, startsAt: e.target.value || null })} />
        </Field>
        <Field label="Hasta">
          <Input type="date" value={block.endsAt ?? ""} min={block.startsAt ?? undefined} onChange={(e) => onChange({ ...block, endsAt: e.target.value || null })} />
        </Field>
      </div>
      <button
        type="button"
        className="text-xs font-medium text-muted-foreground hover:text-foreground"
        onClick={() => {
          onChange({ ...block, startsAt: null, endsAt: null })
          setOpen(false)
        }}
      >
        Quitar fechas
      </button>
    </div>
  )
}
