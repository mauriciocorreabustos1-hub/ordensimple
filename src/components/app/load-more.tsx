import Link from "next/link"
import { Button } from "@/components/ui/button"

export function LoadMore({
  pathname,
  desde,
  hasta,
  page,
  shown,
  total,
}: {
  pathname: string
  desde: string
  hasta: string
  page: number
  shown: number
  total: number
}) {
  if (shown >= total) return null
  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      <p className="text-xs text-muted-foreground">
        Mostrando {shown} de {total}
      </p>
      <Button variant="outline" asChild>
        <Link href={`${pathname}?desde=${desde}&hasta=${hasta}&pagina=${page + 1}`} scroll={false}>
          Ver más
        </Link>
      </Button>
    </div>
  )
}
