import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { PageHeader } from "@/components/app/page-header"

export function ToolShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/herramientas"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Herramientas
      </Link>
      <PageHeader title={title} description={description} />
      {children}
    </div>
  )
}

export function ResultBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
      <p className="text-sm text-primary-foreground/80">{label}</p>
      <p className="tabular text-4xl font-semibold tracking-tight">{value}</p>
      {sub ? <p className="mt-1 text-sm text-primary-foreground/85">{sub}</p> : null}
    </div>
  )
}

export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular text-lg font-semibold">{value}</p>
    </div>
  )
}
