"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2, MessageCircle, Printer, ReceiptText } from "lucide-react"
import { toast } from "sonner"
import { AppModal } from "@/components/app/app-modal"
import { RollWidthSelect, useRollWidth } from "@/components/print/roll-print"
import { TicketFileButtons } from "@/components/print/ticket-file-buttons"
import { Button } from "@/components/ui/button"
import { ROLL_CHARS } from "@/lib/escpos"
import { desktopBridge, isNativeApp } from "@/lib/native-app"
import { getPrinterPrefs, printerError, printTicket, usePrinterPrefs, type PrinterSetup } from "@/lib/printers"
import { saleReceiptText, saleReceiptTicket, type SaleReceiptData } from "@/lib/sale-receipt"
import { ticketLines } from "@/lib/ticket"
import { whatsappLink } from "@/lib/whatsapp"
import { getSaleReceipt } from "@/server/actions/sales"

const OPEN_EVENT = "ordensimple:comprobante"

/** Abre el comprobante de una venta (desde cualquier pantalla del panel). */
export function openSaleReceipt(saleId: string) {
  window.dispatchEvent(new CustomEvent<string>(OPEN_EVENT, { detail: saleId }))
}

/** La impresora para el comprobante: la elegida en este aparato o, en el navegador, la ventana de impresión. */
function receiptPrinter(chosen: PrinterSetup | undefined, width: 58 | 80): PrinterSetup | null {
  if (chosen) return chosen
  return isNativeApp() || desktopBridge() ? null : { kind: "dialog", width }
}

/** Lo que pasa al guardar una venta, según lo elegido en Configuración, sección Impresoras. */
export async function afterSaleSaved(saleId: string) {
  const prefs = getPrinterPrefs()
  const mode = prefs.saleReceipt ?? "show"
  if (mode === "show") return openSaleReceipt(saleId)
  const view = { action: { label: "Ver comprobante", onClick: () => openSaleReceipt(saleId) } }
  if (mode === "off" || !prefs.cuenta) {
    toast.info("Comprobante listo", view)
    return
  }
  const result = await getSaleReceipt(saleId)
  if (!result.ok || !result.data) {
    toast.error(result.ok ? "No se encontró la venta." : result.message)
    return
  }
  try {
    await printTicket(prefs.cuenta, saleReceiptTicket(result.data))
  } catch (error) {
    toast.error(`No salió el comprobante: ${printerError(error)}`, view)
  }
}

/** Botón para volver a ver un comprobante (lista de ventas). */
export function SaleReceiptButton({ saleId }: { saleId: string }) {
  return (
    <Button type="button" variant="ghost" size="icon" title="Ver comprobante" aria-label="Ver comprobante" onClick={() => openSaleReceipt(saleId)}>
      <ReceiptText />
    </Button>
  )
}

/** La ventana del comprobante (una sola, en el panel). */
export function SaleReceiptHost() {
  const [saleId, setSaleId] = React.useState<string | null>(null)
  const [data, setData] = React.useState<SaleReceiptData | null>(null)
  const [printing, setPrinting] = React.useState(false)
  const chosen = usePrinterPrefs().cuenta
  const [rollWidth] = useRollWidth()

  React.useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      setSaleId(id)
      setData(null)
      void getSaleReceipt(id).then((result) => {
        if (result.ok && result.data) return setData(result.data)
        setSaleId(null)
        toast.error(result.ok ? "No se encontró la venta." : result.message)
      })
    }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  const printer = receiptPrinter(chosen, rollWidth)
  const width = printer?.width ?? rollWidth

  async function print() {
    if (!data || !printer) return
    setPrinting(true)
    try {
      const name = await printTicket(printer, saleReceiptTicket(data))
      if (printer.kind !== "dialog" && printer.kind !== "rawbt") toast.success(`Enviado a ${name}`)
    } catch (error) {
      toast.error(printerError(error))
    } finally {
      setPrinting(false)
    }
  }

  return (
    <AppModal open={saleId !== null} onOpenChange={(o) => (o ? null : setSaleId(null))} title="Comprobante de venta" noAutoFocus>
      {!data ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" aria-label="Cargando comprobante" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Se ve tal como sale en la impresora. */}
          <div className="max-h-[50vh] overflow-y-auto rounded-xl bg-muted p-3">
            <div className="mx-auto w-fit rounded-sm bg-white px-4 py-5 font-mono text-[12px] leading-snug text-black shadow-sm">
              {ticketLines(saleReceiptTicket(data), ROLL_CHARS[58]).map((l, i) => (
                <div key={i} className={l.bold ? "font-bold whitespace-pre" : "whitespace-pre"} style={l.center ? { textAlign: "center" } : undefined}>
                  {l.text || " "}
                </div>
              ))}
            </div>
          </div>

          {printer ? (
            <Button size="lg" className="h-12 w-full" onClick={() => void print()} disabled={printing}>
              {printing ? <Loader2 className="animate-spin" /> : <Printer />}
              Imprimir comprobante
            </Button>
          ) : (
            <Button size="lg" className="h-12 w-full" asChild>
              <Link href="/dashboard/configuracion?seccion=impresoras" onClick={() => setSaleId(null)}>
                <Printer />
                Elegir impresora
              </Link>
            </Button>
          )}
          <Button variant="outline" className="w-full" asChild>
            <a href={whatsappLink(data.customerPhone, saleReceiptText(data))} target="_blank" rel="noopener noreferrer">
              <MessageCircle />
              Enviar por WhatsApp
            </a>
          </Button>
          <TicketFileButtons build={() => saleReceiptTicket(data)} fileName={`Comprobante ${data.code}`} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <Link href="/dashboard/configuracion?seccion=impresoras" className="text-primary underline-offset-2 hover:underline" onClick={() => setSaleId(null)}>
              Cambiar impresora o qué pasa al vender
            </Link>
            {printer?.kind === "dialog" && !chosen ? <RollWidthSelect /> : <span>Rollo de {width} mm</span>}
          </div>
          <Button variant="ghost" className="w-full" onClick={() => setSaleId(null)}>
            Listo
          </Button>
        </div>
      )}
    </AppModal>
  )
}
