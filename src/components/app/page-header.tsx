import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-[2rem] md:leading-tight">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-muted-foreground md:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 max-sm:*:flex-1 lg:shrink-0">{actions}</div> : null}
    </div>
  )
}
