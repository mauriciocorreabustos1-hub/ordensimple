import Link from "next/link"
import { AlarmClock, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatMoney } from "@/lib/currency"
import { fiadoReminderText, whatsappLink } from "@/lib/whatsapp"
import type { OverdueDebtor } from "@/server/queries/fiado"

const SHOWN = 6

/** Clientes que se pasaron del plazo de pago del fiado, con un botón para cobrarles por WhatsApp. */
export function OverdueCard({
  debtors,
  days,
  currency,
  businessName,
}: {
  debtors: OverdueDebtor[]
  days: number
  currency: string
  businessName: string
}) {
  const money = (n: number) => formatMoney(n, currency)
  const total = debtors.reduce((s, d) => s + d.balance, 0)
  return (
    <Card className="border-amber-300/70 dark:border-amber-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlarmClock className="size-5 text-amber-600" />
          Por cobrar: se pasaron del plazo
        </CardTitle>
        <CardDescription>
          {debtors.length === 1 ? "1 cliente debe" : `${debtors.length} clientes deben`} {money(total)} hace más de {days} días.{" "}
          <Link href="/dashboard/configuracion#avisos" className="text-primary hover:underline">
            Cambiar plazo
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {debtors.slice(0, SHOWN).map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
              <Link href={`/dashboard/clientes/${d.id}`} className="min-w-0 hover:text-primary">
                <p className="truncate text-sm font-medium">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="tabular font-medium text-foreground">{money(d.balance)}</span> · debe hace {d.days} días
                </p>
              </Link>
              <Button variant="outline" size="sm" asChild className="shrink-0">
                <a
                  href={whatsappLink(d.phone, fiadoReminderText({ customerName: d.name, businessName, amount: money(d.balance) }))}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Cobrar a ${d.name} por WhatsApp`}
                >
                  <MessageCircle />
                  Cobrar
                </a>
              </Button>
            </li>
          ))}
        </ul>
        {debtors.length > SHOWN ? (
          <Link href="/dashboard/clientes?segmento=deben" className="mt-2 inline-block text-sm text-primary hover:underline">
            Ver los {debtors.length}
          </Link>
        ) : null}
      </CardContent>
    </Card>
  )
}
