"use client"

import * as React from "react"
import { Camera, Check, Copy, Download, ExternalLink, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { AppModal } from "@/components/app/app-modal"
import { Field } from "@/components/app/field"
import { CardFace } from "@/components/contact-card/card-face"
import { InstallGuide } from "@/components/contact-card/install-guide"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  normalizePhone,
  normalizeSocial,
  normalizeWebsite,
  slugify,
  SOCIALS,
  toPublicCard,
  type PublishableField,
  type SocialKind,
} from "@/lib/contact-card"
import { shrinkImage, IMAGE_ACCEPT, isImageFile } from "@/lib/image-shrink"
import { deleteContactCard, saveContactCard } from "@/server/actions/contact-card"

type Values = {
  fullName: string
  jobTitle: string
  company: string
  phone: string
  whatsapp: string
  email: string
  website: string
  instagram: string
  facebook: string
  linkedin: string
  tiktok: string
  x: string
}

type Initial = Values & { slug: string; active: boolean; published: string[]; photo: string | null }

function Publishable({
  id,
  label,
  value,
  placeholder,
  on,
  error,
  type = "text",
  inputMode,
  onValue,
  onToggle,
}: {
  id: string
  label: string
  value: string
  placeholder?: string
  on: boolean
  error?: string
  type?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  onValue: (value: string) => void
  onToggle: (on: boolean) => void
}) {
  return (
    <Field label={label} htmlFor={id} error={error}>
      <div className="flex items-center gap-3">
        <Input id={id} type={type} inputMode={inputMode} value={value} onChange={(e) => onValue(e.target.value)} placeholder={placeholder} className="h-10" aria-invalid={Boolean(error)} autoComplete="off" />
        <Switch checked={on} onCheckedChange={onToggle} disabled={!value.trim()} aria-label={`Mostrar ${label.toLowerCase()} en la tarjeta`} />
      </div>
    </Field>
  )
}

const SOCIAL_HINT: Record<SocialKind, string> = { instagram: "@tuusuario", facebook: "tu página o usuario", linkedin: "in/tuusuario", tiktok: "@tuusuario", x: "@tuusuario" }

export function ContactCardEditor({
  initial,
  prefill,
  host,
  url,
  qr,
  logoUrl,
}: {
  initial: Initial | null
  prefill: { fullName: string; email: string; company: string }
  host: string
  url: string | null
  qr: string | null
  logoUrl: string | null
}) {
  const [values, setValues] = React.useState<Values>(() => ({
    fullName: initial?.fullName ?? prefill.fullName,
    jobTitle: initial?.jobTitle ?? "",
    company: initial?.company ?? prefill.company,
    phone: initial?.phone ?? "",
    whatsapp: initial?.whatsapp ?? "",
    email: initial?.email ?? prefill.email,
    website: initial?.website ?? "",
    instagram: initial?.instagram ?? "",
    facebook: initial?.facebook ?? "",
    linkedin: initial?.linkedin ?? "",
    tiktok: initial?.tiktok ?? "",
    x: initial?.x ?? "",
  }))
  const [published, setPublished] = React.useState(() => new Set<string>(initial?.published ?? []))
  const [active, setActive] = React.useState(initial?.active ?? true)
  const [slug, setSlug] = React.useState(() => initial?.slug ?? slugify(prefill.fullName))
  const [photo, setPhoto] = React.useState<string | null>(initial?.photo ?? null)
  // undefined: la foto no cambió.
  const [photoChange, setPhotoChange] = React.useState<string | null | undefined>(undefined)
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({})
  const [copied, setCopied] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const photoInput = React.useRef<HTMLInputElement>(null)

  function setValue(key: keyof Values, value: string) {
    // Al escribir en un campo vacío se activa, a la vista; el correo y la empresa propuestos parten apagados.
    if (!values[key].trim() && value.trim()) setPublished((p) => new Set(p).add(key))
    if (!value.trim())
      setPublished((p) => {
        const next = new Set(p)
        next.delete(key)
        return next
      })
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function toggle(key: PublishableField, on: boolean) {
    setPublished((p) => {
      const next = new Set(p)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const field = (key: keyof Values, label: string, extra: Partial<React.ComponentProps<typeof Publishable>> = {}) => (
    <Publishable id={`card-${key}`} label={label} value={values[key]} on={published.has(key)} error={errors[key]?.[0]} onValue={(v) => setValue(key, v)} onToggle={(on) => toggle(key as PublishableField, on)} {...extra} />
  )

  async function pickPhoto(file: File | undefined) {
    if (!file) return
    if (!isImageFile(file)) return void toast.error("Elige una imagen JPG, PNG o HEIC.")
    try {
      const data = await shrinkImage(file, 512, true, "jpeg")
      setPhoto(data)
      setPhotoChange(data)
      toggle("photo", true)
    } catch {
      toast.error("No pudimos leer esa imagen. Prueba con otra.")
    }
    if (photoInput.current) photoInput.current.value = ""
  }

  function removePhoto() {
    setPhoto(null)
    setPhotoChange(null)
    toggle("photo", false)
  }

  // Lo que se verá: pasa por el mismo filtro que la tarjeta pública.
  const preview = toPublicCard(
    {
      slug: slug || "tu-nombre",
      fullName: values.fullName.trim() || "Tu nombre",
      jobTitle: values.jobTitle.trim() || null,
      company: values.company.trim() || null,
      phone: normalizePhone(values.phone),
      whatsapp: normalizePhone(values.whatsapp),
      email: values.email.trim() || null,
      website: normalizeWebsite(values.website),
      instagram: normalizeSocial("instagram", values.instagram),
      facebook: normalizeSocial("facebook", values.facebook),
      linkedin: normalizeSocial("linkedin", values.linkedin),
      tiktok: normalizeSocial("tiktok", values.tiktok),
      x: normalizeSocial("x", values.x),
      published: [...published],
      photoUpdatedAt: null,
      updatedAt: new Date(0),
    },
    logoUrl,
  )
  const shown = { ...preview, photoUrl: published.has("photo") ? photo : null }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    startTransition(async () => {
      const r = await saveContactCard({ ...values, slug, active, published: [...published] as PublishableField[], photo: photoChange })
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {})
        toast.error(r.message)
        return
      }
      setPhotoChange(undefined)
      toast.success(r.message ?? "Tarjeta guardada")
    })
  }

  async function copyLink() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error("No se pudo copiar. Selecciona el enlace y cópialo a mano.")
    }
  }

  function remove() {
    startTransition(async () => {
      const r = await deleteContactCard()
      if (r.ok) toast.success(r.message ?? "Tarjeta eliminada")
      else toast.error(r.message)
      setConfirmDelete(false)
    })
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <form onSubmit={submit} className="space-y-6">
        <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-xs md:p-5">
          <h2 className="font-display text-lg font-semibold tracking-tight">Enlace</h2>
          {initial ? (
            <div className="space-y-1">
              <p className="font-medium break-all">
                {host}/perfil/{initial.slug}
              </p>
              <p className="text-sm text-pretty text-muted-foreground">El enlace y el código QR no cambian, aunque edites tus datos.</p>
            </div>
          ) : (
            <Field label="Elige tu enlace" htmlFor="card-slug" error={errors.slug?.[0]} hint="No se puede cambiar después: así el enlace y el código QR siempre funcionan.">
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 text-sm text-muted-foreground">{host}/perfil/</span>
                <Input id="card-slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30))} className="h-10" aria-invalid={Boolean(errors.slug)} autoCapitalize="none" autoComplete="off" />
              </div>
            </Field>
          )}
          <label className="flex items-center justify-between gap-3 border-t pt-4">
            <span>
              <span className="block text-sm font-medium">Tarjeta publicada</span>
              <span className="block text-xs text-muted-foreground">Apagada, el enlace y el QR dejan de mostrarla.</span>
            </span>
            <Switch checked={active} onCheckedChange={setActive} aria-label="Tarjeta publicada" />
          </label>
        </section>

        <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-xs md:p-5">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Tus datos</h2>
            <p className="text-sm text-muted-foreground">Cada interruptor decide si ese dato se ve en tu tarjeta.</p>
          </div>
          <Field label="Nombre" htmlFor="card-fullName" error={errors.fullName?.[0]} hint="Tu nombre siempre se muestra.">
            <Input id="card-fullName" value={values.fullName} onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))} className="h-10" maxLength={80} autoComplete="off" />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div className="flex items-center gap-3">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="Tu foto" className="size-14 rounded-xl object-cover" />
              ) : (
                <span className="flex size-14 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Camera className="size-5" aria-hidden />
                </span>
              )}
              <div className="flex flex-wrap gap-1.5">
                <Button type="button" variant="outline" size="sm" onClick={() => photoInput.current?.click()}>
                  {photo ? "Cambiar foto" : "Subir foto"}
                </Button>
                {photo ? (
                  <Button type="button" variant="ghost" size="sm" onClick={removePhoto}>
                    Quitar
                  </Button>
                ) : null}
              </div>
            </div>
            <Switch checked={published.has("photo")} onCheckedChange={(on) => toggle("photo", on)} disabled={!photo} aria-label="Mostrar foto en la tarjeta" />
            <input ref={photoInput} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} aria-label="Elegir foto" />
          </div>
          {errors.photo?.[0] ? <p className="text-xs text-destructive">{errors.photo[0]}</p> : null}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Logo del negocio</p>
              <p className="text-xs text-muted-foreground">{logoUrl ? "El logo que tiene tu negocio en OrdenSimple." : "Tu negocio todavía no tiene logo. Puedes subirlo en Configuración."}</p>
            </div>
            <Switch checked={published.has("logo")} onCheckedChange={(on) => toggle("logo", on)} disabled={!logoUrl} aria-label="Mostrar logo en la tarjeta" />
          </div>
          <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
            {field("jobTitle", "Cargo", { placeholder: "Gerente comercial" })}
            {field("company", "Empresa")}
            {field("phone", "Teléfono", { inputMode: "tel", placeholder: "+56 9 1234 5678" })}
            {field("whatsapp", "WhatsApp", { inputMode: "tel", placeholder: "+56 9 1234 5678" })}
            {field("email", "Correo", { type: "email", inputMode: "email" })}
            {field("website", "Sitio web", { inputMode: "url", placeholder: "miempresa.cl" })}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-xs md:p-5">
          <h2 className="font-display text-lg font-semibold tracking-tight">Redes sociales</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {(Object.keys(SOCIALS) as SocialKind[]).map((kind) => (
              <React.Fragment key={kind}>{field(kind, SOCIALS[kind].label, { placeholder: SOCIAL_HINT[kind] })}</React.Fragment>
            ))}
          </div>
        </section>

        <Button type="submit" size="lg" className="h-12 w-full text-base sm:w-auto sm:px-8" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {initial ? "Guardar cambios" : "Crear mi tarjeta"}
        </Button>
      </form>

      <aside className="space-y-4 lg:sticky lg:top-6">
        <div className="overflow-hidden rounded-3xl border shadow-sm">
          <CardFace card={shown} preview />
        </div>
        <p className="text-center text-xs text-muted-foreground">Vista previa de lo que se publicará.</p>

        {url && qr ? (
          <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-xs">
            <h2 className="font-display text-lg font-semibold tracking-tight">Compartir</h2>
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Código QR de tu tarjeta" className="size-24 rounded-lg border" />
              <div className="grid min-w-0 flex-1 gap-1.5">
                <Button type="button" variant="outline" size="sm" onClick={copyLink}>
                  {copied ? <Check /> : <Copy />}
                  {copied ? "Enlace copiado" : "Copiar enlace"}
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={qr} download="codigo-qr-tarjeta.png">
                    <Download />
                    Descargar QR
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink />
                    Abrir tarjeta
                  </a>
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        {url ? (
          <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-xs">
            <h2 className="font-display text-lg font-semibold tracking-tight">Instálala en tu celular</h2>
            <InstallGuide />
          </section>
        ) : null}

        {initial ? (
          <Button type="button" variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setConfirmDelete(true)}>
            <Trash2 />
            Eliminar tarjeta
          </Button>
        ) : null}
      </aside>

      <AppModal open={confirmDelete} onOpenChange={setConfirmDelete} title="¿Eliminar tu tarjeta?" description="El enlace y el código QR dejarán de funcionar. Si solo quieres ocultarla, apaga “Tarjeta publicada”.">
        <Button type="button" variant="destructive" size="lg" className="h-11 w-full" disabled={pending} onClick={remove}>
          {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
          Eliminar tarjeta
        </Button>
      </AppModal>
    </div>
  )
}
