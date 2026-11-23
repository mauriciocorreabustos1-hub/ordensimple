"use client"

import * as React from "react"
import { Switch } from "@/components/ui/switch"
import { ImageField, ProTag, TextField } from "@/components/links/editor/fields"
import { normalizePhone } from "@/lib/contact-card"
import type { LinkContent } from "@/lib/links"

export function ProfilePanel({ content, onChange, hasLogo, pro }: { content: LinkContent; onChange: (c: LinkContent) => void; hasLogo: boolean; pro: boolean }) {
  const p = content.profile
  // Siempre sobre el contenido más reciente: los campos memorizados pueden conservar una versión anterior de estas funciones.
  const latest = React.useRef(content)
  React.useLayoutEffect(() => {
    latest.current = content
  })
  const set = (patch: Partial<LinkContent["profile"]>) => onChange({ ...latest.current, profile: { ...latest.current.profile, ...patch } })
  const seo = (patch: Partial<LinkContent["seo"]>) => onChange({ ...latest.current, seo: { ...latest.current.seo, ...patch } })

  return (
    <div className="space-y-7">
      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Quién eres</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <ImageField label="Foto de perfil" value={p.avatar} onChange={(avatar) => set({ avatar })} square max={480} />
            {!p.avatar && hasLogo ? (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch size="sm" checked={p.useLogo} onCheckedChange={(useLogo) => set({ useLogo })} aria-label="Usar el logo del negocio" />
                Usar el logo de mi negocio
              </label>
            ) : null}
          </div>
          <ImageField label="Portada" value={p.cover} onChange={(cover) => set({ cover })} max={1400} hint="Una foto ancha arriba de todo (local, productos, equipo)." />
        </div>
        <TextField label="Nombre" value={p.name} max={80} onChange={(name) => set({ name })} error={p.name.trim().length < 2 ? "Escribe el nombre que se verá arriba" : null} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Rubro (opcional)" value={p.category} max={60} placeholder="Pastelería artesanal" onChange={(category) => set({ category })} />
          <TextField label="Ubicación (opcional)" value={p.location} max={80} placeholder="Ñuñoa, Santiago" onChange={(location) => set({ location })} />
        </div>
        <TextField label="Descripción" value={p.bio} max={300} multiline placeholder="Qué haces, para quién y por qué elegirte, en una o dos frases." onChange={(bio) => set({ bio })} />
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Contacto bajo tu nombre</h3>
          <p className="text-xs text-muted-foreground">Opcional. Se muestran como botones chicos debajo de la descripción.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Teléfono" value={p.phone} max={30} type="tel" inputMode="tel" onChange={(phone) => set({ phone })} error={p.phone && !normalizePhone(p.phone) ? "Escribe un teléfono válido" : null} />
          <TextField label="Correo" value={p.email} max={120} type="email" inputMode="email" onChange={(email) => set({ email })} error={p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.email) ? "Escribe un correo válido" : null} />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Cómo se ve en Google y al compartir</h3>
          <p className="text-xs text-muted-foreground">Si lo dejas vacío usamos tu nombre y tu descripción. La foto es tu portada (o tu foto de perfil).</p>
        </div>
        <TextField label="Título" value={content.seo.title} max={70} placeholder={p.name} onChange={(title) => seo({ title })} />
        <TextField label="Descripción" value={content.seo.description} max={160} multiline placeholder={p.bio || "Qué encontrarán en tu página"} onChange={(description) => seo({ description })} />
        {/* Así se ve el enlace pegado en WhatsApp. */}
        <figure className="overflow-hidden rounded-xl border bg-muted/40">
          <figcaption className="px-3 pt-2 text-[11px] text-muted-foreground">Así se ve al pegar el enlace en WhatsApp</figcaption>
          <div className="m-3 mt-2 overflow-hidden rounded-lg bg-background">
            <p className="truncate px-3 pt-2 text-sm font-semibold">{content.seo.title || p.name || "Tu nombre"}</p>
            <p className="line-clamp-2 px-3 pt-0.5 pb-2.5 text-xs text-muted-foreground">{content.seo.description || p.bio || `Enlaces, contacto y redes de ${p.name || "tu negocio"}.`}</p>
          </div>
        </figure>
      </section>

      <label className="flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3">
        <span className="text-[13px]">
          <span className="flex items-center gap-1.5 font-medium">Mostrar “Hecho con OrdenSimple” al pie {!pro ? <ProTag /> : null}</span>
          <span className="block text-xs text-muted-foreground">En el plan Pro lo puedes quitar.</span>
        </span>
        <Switch checked={content.branding} onCheckedChange={(branding) => onChange({ ...content, branding })} aria-label="Mostrar Hecho con OrdenSimple" />
      </label>
    </div>
  )
}
