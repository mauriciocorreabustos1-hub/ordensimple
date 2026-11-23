"use client"

import * as React from "react"
import { AlertTriangle, Check, Sparkles, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ColorField, Field, ImageField, ProTag, Segmented } from "@/components/links/editor/fields"
import { contrastIssues, fixContrast, FONTS, TEMPLATES, templateTheme, type FontKey, type LinkTheme } from "@/lib/links"
import { cn } from "@/lib/utils"

const RADIUS_PX = { none: 0, sm: 3, md: 6, full: 99 }

/** Miniatura de una plantilla: el fondo, la foto, el nombre y tres botones con su estilo real. */
const TemplateThumb = React.memo(function TemplateThumb({ theme }: { theme: Omit<LinkTheme, "template"> }) {
  const bg = theme.bg.kind === "gradient" ? `linear-gradient(${theme.bg.angle}deg, ${theme.bg.color}, ${theme.bg.color2})` : theme.bg.color
  const r = RADIUS_PX[theme.radius]
  const left = theme.align === "left" || theme.header === "left"
  const btn: React.CSSProperties =
    theme.button === "outline"
      ? { border: `1.5px solid ${theme.accent}`, borderRadius: r }
      : theme.button === "soft"
        ? { background: `color-mix(in oklab, ${theme.text} 14%, transparent)`, borderRadius: r }
        : theme.button === "hard"
          ? { background: theme.accent, border: `1.5px solid ${theme.text}`, boxShadow: `2px 2px 0 ${theme.text}`, borderRadius: r }
          : { background: theme.accent, borderRadius: r, boxShadow: theme.shadow ? "0 3px 6px -3px rgb(0 0 0 / .4)" : undefined }
  return (
    <span aria-hidden className="flex aspect-[3/4] w-full flex-col overflow-hidden rounded-lg border border-black/5" style={{ background: bg }}>
      {theme.header === "cover" ? <span className="h-[22%] w-full shrink-0" style={{ background: `color-mix(in oklab, ${theme.text} 22%, transparent)` }} /> : null}
      <span className={cn("flex flex-1 flex-col gap-[7%] px-[12%]", theme.header === "cover" ? "pt-0" : "pt-[14%]")}>
        <span className={cn("flex items-center gap-[6%]", left ? "flex-row" : "flex-col", theme.header === "cover" && "-mt-[11%]")}>
          <span className="aspect-square w-[26%] shrink-0 rounded-full" style={{ background: theme.accent, outline: `2px solid color-mix(in oklab, ${theme.text} 12%, transparent)` }} />
          <span className="h-[5px] w-[46%] rounded-full" style={{ background: theme.text, opacity: 0.85 }} />
        </span>
        <span className="flex flex-col gap-[9px] pt-[4%]">
          <span className="h-[13px] w-full" style={btn} />
          <span className="h-[13px] w-full" style={btn} />
          <span className="h-[13px] w-full" style={btn} />
        </span>
      </span>
    </span>
  )
})

export function DesignPanel({
  theme,
  onChange,
  pro,
  onSuggestBlocks,
  canSuggest,
}: {
  theme: LinkTheme
  onChange: (t: LinkTheme) => void
  pro: boolean
  onSuggestBlocks: (templateId: string) => void
  canSuggest: boolean
}) {
  const set = (patch: Partial<LinkTheme>) => onChange({ ...theme, ...patch })
  const setBg = (patch: Partial<LinkTheme["bg"]>) => onChange({ ...theme, bg: { ...theme.bg, ...patch } })
  const issues = contrastIssues(theme)
  const current = TEMPLATES.find((t) => t.id === theme.template)

  return (
    <div className="space-y-7">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Plantilla</h3>
          <p className="text-xs text-muted-foreground">Cambia los colores, la letra y los botones. Tus bloques y tus datos se mantienen.</p>
        </div>
        <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
          {TEMPLATES.map((t) => {
            const active = theme.template === t.id
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onChange(templateTheme(t.id))}
                  aria-pressed={active}
                  className={cn("group w-full rounded-xl p-1 text-left transition-colors", active ? "bg-primary/10 ring-2 ring-primary" : "hover:bg-muted")}
                  title={t.for}
                >
                  <TemplateThumb theme={t.theme} />
                  <span className="mt-1.5 flex items-center gap-1 px-0.5 text-[12px] leading-tight font-medium">
                    <span className="truncate">{t.name}</span>
                    {t.pro && !pro ? <ProTag className="shrink-0" /> : null}
                    {active ? <Check className="ml-auto size-3.5 shrink-0 text-primary" /> : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {current && canSuggest ? (
          <button type="button" onClick={() => onSuggestBlocks(current.id)} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
            <Sparkles className="size-3.5" /> Agregar los bloques sugeridos para {current.name.toLowerCase()}
          </button>
        ) : null}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Fondo</h3>
        <Segmented
          label="Tipo de fondo"
          value={theme.bg.kind}
          onChange={(kind) => setBg({ kind })}
          options={[
            { value: "solid", label: "Color" },
            { value: "gradient", label: <>Degradado {!pro ? <ProTag /> : null}</> },
            { value: "image", label: <>Foto {!pro ? <ProTag /> : null}</> },
          ]}
        />
        {theme.bg.kind === "image" ? (
          <div className="space-y-3">
            <ImageField label="Foto de fondo" value={theme.bg.image} onChange={(image) => setBg({ image })} max={1400} />
            <Field label="Para que se lea el texto" hint="Ponemos un velo sobre la foto y el texto queda blanco o negro.">
              <Segmented label="Velo sobre la foto" value={theme.bg.overlay} onChange={(overlay) => setBg({ overlay })} options={[{ value: "dark", label: "Oscurecer" }, { value: "light", label: "Aclarar" }]} />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <ColorField label={theme.bg.kind === "gradient" ? "Color de arriba" : "Color de fondo"} value={theme.bg.color} onChange={(color) => setBg({ color })} />
            {theme.bg.kind === "gradient" ? <ColorField label="Color de abajo" value={theme.bg.color2} onChange={(color2) => setBg({ color2 })} /> : <ColorField label="Color del texto" value={theme.text} onChange={(text) => set({ text })} />}
            {theme.bg.kind === "gradient" ? <ColorField label="Color del texto" value={theme.text} onChange={(text) => set({ text })} /> : null}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Botones</h3>
        <div className="grid grid-cols-2 gap-3">
          <ColorField label="Color principal" value={theme.accent} onChange={(accent) => set({ accent })} />
          <ColorField label="Texto de los botones" value={theme.accentText} onChange={(accentText) => set({ accentText })} />
        </div>
        <Field label="Estilo">
          <Segmented
            label="Estilo de los botones"
            value={theme.button}
            onChange={(button) => set({ button })}
            options={[
              { value: "fill", label: "Relleno" },
              { value: "outline", label: "Contorno" },
              { value: "soft", label: "Suave" },
              { value: "hard", label: "Marcado" },
            ]}
          />
        </Field>
        <Field label="Esquinas">
          <Segmented
            label="Esquinas de los botones"
            value={theme.radius}
            onChange={(radius) => set({ radius })}
            options={[
              { value: "none", label: "Rectas" },
              { value: "sm", label: "Leves" },
              { value: "md", label: "Suaves" },
              { value: "full", label: "Píldora" },
            ]}
          />
        </Field>
        <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <span className="flex items-center gap-1.5 text-[13px] font-medium">Sombra {!pro ? <ProTag /> : null}</span>
          <Switch checked={theme.shadow} onCheckedChange={(shadow) => set({ shadow })} aria-label="Sombra en botones y tarjetas" />
        </label>
      </section>

      {issues.length ? (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50 px-3.5 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium">{issues.map((i) => i.message).join(" ")}</p>
            <p className="text-xs opacity-90">A pleno sol o con la vista cansada cuesta leerlo. En la página publicada lo corregimos solo, pero es mejor elegirlo tú.</p>
          </div>
          <Button type="button" size="sm" variant="outline" className="shrink-0 bg-background" onClick={() => onChange(fixContrast(theme))}>
            <Wand2 /> Arreglar
          </Button>
        </div>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Letra</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(FONTS) as FontKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => set({ font: key })}
              aria-pressed={theme.font === key}
              className={cn("rounded-xl border px-3 py-2.5 text-left transition-colors", theme.font === key ? "border-primary bg-primary/[0.06]" : "hover:bg-muted")}
            >
              <span className="block text-lg leading-tight" style={{ fontFamily: FONTS[key].css }}>
                Hola, Ana
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                {FONTS[key].label}
                {FONTS[key].pro && !pro ? <ProTag /> : null}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Distribución</h3>
        <Field label="Encabezado">
          <Segmented
            label="Encabezado"
            value={theme.header}
            onChange={(header) => set({ header })}
            options={[
              { value: "classic", label: "Clásico" },
              { value: "cover", label: "Con portada" },
              { value: "left", label: "En fila" },
            ]}
          />
        </Field>
        <Field label="Alineación">
          <Segmented label="Alineación" value={theme.align} onChange={(align) => set({ align })} options={[{ value: "center", label: "Centrada" }, { value: "left", label: "A la izquierda" }]} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tamaño del texto">
            <Segmented label="Tamaño del texto" value={theme.size} onChange={(size) => set({ size })} options={[{ value: "s", label: "Chico" }, { value: "m", label: "Normal" }, { value: "l", label: "Grande" }]} />
          </Field>
          <Field label="Separación">
            <Segmented label="Separación entre bloques" value={theme.spacing} onChange={(spacing) => set({ spacing })} options={[{ value: "compact", label: "Junta" }, { value: "normal", label: "Normal" }, { value: "airy", label: "Amplia" }]} />
          </Field>
        </div>
        {!pro ? <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ProTag /> El tamaño y la separación distintos a “Normal” son del plan Pro.</p> : null}
      </section>
    </div>
  )
}
