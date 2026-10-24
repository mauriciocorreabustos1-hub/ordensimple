"use client"

import * as React from "react"
import { Bluetooth, Loader2, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useRollWidth } from "@/components/print/roll-print"
import { bluetoothError, canUseWebBluetooth, connectedPrinterName, isAndroid, isIos, printViaBluetooth, rawbtLink } from "@/lib/bluetooth-print"
import { ROLL_CHARS } from "@/lib/escpos"

/**
 * Imprimir en una impresora térmica Bluetooth: directo desde Chrome o Edge (Android y computador), o con la app
 * RawBT en Android. Solo se muestra donde el navegador lo hace posible. Este paso se abre al tocar un botón (nunca en el servidor).
 */
export function BluetoothPrintButton({ build, disabled }: { build: (charsPerLine: number) => Uint8Array; disabled?: boolean }) {
  const [width] = useRollWidth()
  const [pending, setPending] = React.useState(false)
  const [printer, setPrinter] = React.useState(connectedPrinterName)
  const chars = ROLL_CHARS[width]

  if (isIos()) {
    return <p className="text-xs text-muted-foreground">En iPhone el navegador no puede usar Bluetooth: imprime desde un computador o un celular Android.</p>
  }
  const direct = canUseWebBluetooth()
  const android = isAndroid()
  if (!direct && !android) {
    return <p className="text-xs text-muted-foreground">Para imprimir por Bluetooth, abre OrdenSimple en Chrome o Edge.</p>
  }

  async function print() {
    setPending(true)
    try {
      const name = await printViaBluetooth(build(chars))
      setPrinter(name)
      toast.success(`Enviado a ${name}`)
    } catch (error) {
      toast.error(bluetoothError(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-2 rounded-xl border p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Bluetooth className="size-4 text-primary" />
        Impresora Bluetooth
      </p>
      <div className="flex flex-wrap gap-2">
        {direct ? (
          <Button variant="outline" onClick={() => void print()} disabled={disabled || pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Bluetooth />}
            {printer ? `Imprimir en ${printer}` : "Imprimir por Bluetooth"}
          </Button>
        ) : null}
        {android ? (
          <Button variant="outline" asChild disabled={disabled}>
            <a href={disabled ? undefined : rawbtLink(build(chars))}>
              <Smartphone />
              Con la app RawBT
            </a>
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {direct ? "La primera vez elige tu impresora en la lista; después se usa la misma. " : ""}
        {android
          ? "Si tu impresora no aparece, instala la app gratuita RawBT desde Google Play, conéctala ahí una vez y usa el botón “Con la app RawBT”."
          : ""}
      </p>
    </div>
  )
}
