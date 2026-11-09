import { AtSign, Globe, Mail, MessageCircle, Phone, type LucideIcon } from "lucide-react"
import { formatPhone, initialsOf, type PublicContactCard } from "@/lib/contact-card"

type Row = { icon: LucideIcon; label: string; value: string; href: string; external?: boolean }

function rowsOf(card: PublicContactCard): Row[] {
  const rows: Row[] = []
  if (card.phone) rows.push({ icon: Phone, label: "Teléfono", value: formatPhone(card.phone), href: `tel:${card.phone}` })
  if (card.whatsapp && card.whatsappUrl) rows.push({ icon: MessageCircle, label: "WhatsApp", value: formatPhone(card.whatsapp), href: card.whatsappUrl, external: true })
  if (card.email) rows.push({ icon: Mail, label: "Correo", value: card.email, href: `mailto:${card.email}` })
  if (card.website) rows.push({ icon: Globe, label: "Sitio web", value: card.website.replace(/^https?:\/\/(www\.)?/, ""), href: card.website, external: true })
  return rows
}

/**
 * La tarjeta: la usan la página pública y la vista previa del editor. En la vista previa (`preview`) los datos no son enlaces.
 * Los botones de la página pública llegan como `actions`.
 */
export function CardFace({ card, preview, actions, children }: { card: PublicContactCard; preview?: boolean; actions?: React.ReactNode; children?: React.ReactNode }) {
  const rows = rowsOf(card)
  return (
    <article className="overflow-hidden bg-card text-card-foreground sm:rounded-3xl sm:shadow-2xl">
      <header className="bg-deep px-6 pt-7 pb-8 text-deep-foreground">
        {card.logoUrl ? (
          // El logo y la foto ya vienen achicados: no hace falta optimizarlos de nuevo.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.logoUrl} alt={card.company ? `Logo de ${card.company}` : "Logo"} className="mb-6 h-10 max-w-40 rounded-md bg-white object-contain p-1" />
        ) : null}
        <div className="flex items-center gap-4">
          {card.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.photoUrl} alt={`Foto de ${card.fullName}`} className="size-24 shrink-0 rounded-2xl object-cover" />
          ) : (
            <span aria-hidden className="font-display flex size-24 shrink-0 items-center justify-center rounded-2xl bg-deep-foreground/12 text-3xl font-semibold">
              {initialsOf(card.fullName)}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-[1.7rem] leading-tight font-semibold tracking-tight text-balance break-words">{card.fullName}</h1>
            {card.jobTitle ? <p className="mt-1 text-pretty text-deep-foreground/85">{card.jobTitle}</p> : null}
            {card.company ? <p className="text-sm text-pretty text-deep-foreground/70">{card.company}</p> : null}
          </div>
        </div>
      </header>

      <div className="space-y-6 px-6 py-6">
        {actions}

        {rows.length ? (
          <ul className="divide-y border-y">
            {rows.map((r) => {
              const body = (
                <>
                  <r.icon className="size-5 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-xs text-muted-foreground">{r.label}</span>
                    <span className="block truncate font-medium">{r.value}</span>
                  </span>
                </>
              )
              return (
                <li key={r.label}>
                  {preview ? (
                    <div className="flex min-h-14 items-center gap-3.5 py-2">{body}</div>
                  ) : (
                    <a href={r.href} {...(r.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="flex min-h-14 items-center gap-3.5 py-2 transition-colors hover:text-primary">
                      {body}
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        ) : null}

        {card.socials.length ? (
          <ul className="flex flex-wrap gap-2">
            {card.socials.map((s) => (
              <li key={s.kind}>
                {preview ? (
                  <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium">
                    <AtSign className="size-4 text-primary" aria-hidden />
                    {s.label}
                  </span>
                ) : (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted">
                    <AtSign className="size-4 text-primary" aria-hidden />
                    {s.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : null}

        {children}
      </div>
    </article>
  )
}
