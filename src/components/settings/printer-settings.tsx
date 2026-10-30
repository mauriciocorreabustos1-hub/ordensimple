"use client"

import * as React from "react"
import { Bluetooth, Download, Loader2, Printer, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Field } from "@/components/app/field"
import { isIos } from "@/lib/bluetooth-print"
import { isNativeApp } from "@/lib/native-app"
import { kitchenTicket } from "@/lib/kitchen-ticket"
import { Ticket } from "@/lib/ticket"
import {
  availableKinds,
  chooseSerialPort,
  chooseUsbPrinter,
  isWindows,
  kioskShortcut,
  PRINTER_KINDS,
  printerError,
  printTicket,
  scanClassicPrinters,
  setPrinterPrefs,
  usePrinterPrefs,
  type PrinterKind,
  type PrinterRole,
  type PrinterSetup,
} from "@/lib/printers"

const ROLE_TEXT: Record<PrinterRole, { title: string; description: string }> = {
  cuenta: { title: "Boletas y cuentas", description: "Donde sale la cuenta de cada mesa al tocar Imprimir." },
  cocina: { title: "Comandas para la cocina", description: "Donde sale lo que hay que preparar, sin precios y con letra grande." },
}

/** Formas de conectar que este aparato no tiene, y dónde sí se puede. */
function missingNote(kinds: PrinterKind[]) {
  const notes: string[] = []
  if (!kinds.includes("network"))
    notes.push(
      isWindows()
        ? "Las impresoras de red (Wi-Fi o cable) se usan aquí si están instaladas en Windows; directo por su IP, desde la app de OrdenSimple."
        : "Las impresoras de red (Wi-Fi o cable) se usan desde la app de OrdenSimple para Android o iPhone.",
    )
  if (!kinds.includes("bt-classic"))
    notes.push(
      isIos()
        ? "Las impresoras Bluetooth clásicas no funcionan con iPhone (Apple no lo permite a ninguna app): usa una BLE o de red."
        : "Las impresoras Bluetooth clásicas se usan desde la app de OrdenSimple para Android, o con la app RawBT.",
    )
  if (isWindows()) notes.push("En Windows las impresoras USB se usan como “Impresora instalada en el computador”: Windows no deja que el navegador les hable directo.")
  else if (!kinds.includes("usb") && !isNativeApp()) notes.push("USB directo y puerto serie funcionan en Chrome o Edge.")
  return notes
}

function PrinterCard({ role, kinds }: { role: PrinterRole; kinds: PrinterKind[] }) {
  const prefs = usePrinterPrefs()
  const setup: PrinterSetup | undefined = prefs[role]
  const [busy, setBusy] = React.useState<null | "scan" | "test" | "choose">(null)
  const [found, setFound] = React.useState<{ name: string; address: string }[] | null>(null)

  function save(next: PrinterSetup | undefined) {
    setPrinterPrefs((p) => ({ ...p, [role]: next }))
  }
  function pick(kind: PrinterKind | "") {
    setFound(null)
    if (!kind) return save(undefined)
    save({ kind, width: setup?.width ?? 80, port: kind === "network" ? 9100 : undefined })
  }

  async function run(what: "scan" | "test" | "choose", fn: () => Promise<void>) {
    setBusy(what)
    try {
      await fn()
    } catch (error) {
      toast.error(printerError(error))
    } finally {
      setBusy(null)
    }
  }

  function test() {
    if (!setup) return
    const t =
      role === "cocina"
        ? kitchenTicket("Mesa de prueba", [{ description: "Lomo a lo pobre", quantity: 2, note: "Uno sin cebolla" }, { description: "Bebida", quantity: 1 }])
        : new Ticket().line("OrdenSimple", { bold: true, center: true }).line("Prueba de impresora", { center: true }).rule().row("1 x Producto", "$1.000").rule().row("TOTAL", "$1.000", { bold: true }).cut()
    void run("test", async () => {
      const name = await printTicket(setup, t)
      if (setup.kind !== "dialog" && setup.kind !== "rawbt") toast.success(`Enviado a ${name}`)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="size-4 text-primary" />
          {ROLE_TEXT[role].title}
        </CardTitle>
        <CardDescription>{ROLE_TEXT[role].description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
          <Field label="Cómo está conectada" htmlFor={`printer-kind-${role}`}>
            <select
              id={`printer-kind-${role}`}
              value={setup?.kind ?? ""}
              onChange={(e) => pick(e.target.value as PrinterKind | "")}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">{role === "cuenta" ? "Sin elegir (se pregunta al imprimir)" : "Sin impresora de cocina"}</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {PRINTER_KINDS[k].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Papel" htmlFor={`printer-width-${role}`}>
            <select
              id={`printer-width-${role}`}
              value={setup?.width ?? 80}
              disabled={!setup}
              onChange={(e) => setup && save({ ...setup, width: e.target.value === "58" ? 58 : 80 })}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-50"
            >
              <option value={80}>Rollo de 80 mm</option>
              <option value={58}>Rollo de 58 mm</option>
            </select>
          </Field>
        </div>

        {setup ? <p className="text-xs text-muted-foreground">{PRINTER_KINDS[setup.kind].hint}</p> : null}

        {setup?.kind === "network" ? (
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
            <Field label="Dirección IP" htmlFor={`printer-host-${role}`}>
              <Input
                id={`printer-host-${role}`}
                inputMode="decimal"
                placeholder="192.168.1.100"
                defaultValue={setup.host ?? ""}
                onBlur={(e) => save({ ...setup, host: e.target.value.trim() })}
              />
            </Field>
            <Field label="Puerto" htmlFor={`printer-port-${role}`}>
              <Input
                id={`printer-port-${role}`}
                inputMode="numeric"
                defaultValue={String(setup.port ?? 9100)}
                onBlur={(e) => save({ ...setup, port: Number(e.target.value) || 9100 })}
              />
            </Field>
          </div>
        ) : null}

        {setup?.kind === "bt-classic" ? (
          <div className="space-y-2">
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={() =>
                void run("scan", async () => {
                  const list = await scanClassicPrinters()
                  setFound(list)
                  if (!list.length) toast.info("No se encontró ninguna impresora. Revisa que esté encendida y cerca.")
                })
              }
            >
              {busy === "scan" ? <Loader2 className="animate-spin" /> : <Search />}
              {busy === "scan" ? "Buscando (unos 12 segundos)…" : setup.address ? "Buscar otra impresora" : "Buscar impresoras"}
            </Button>
            {setup.address ? <p className="text-sm">Elegida: <strong>{setup.name || setup.address}</strong></p> : null}
            {found?.length ? (
              <div className="divide-y rounded-xl border">
                {found.map((d) => (
                  <button
                    key={d.address}
                    type="button"
                    onClick={() => {
                      save({ ...setup, address: d.address, name: d.name || d.address })
                      setFound(null)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted"
                  >
                    <Bluetooth className="size-4 text-primary" />
                    <span className="min-w-0 flex-1 truncate">{d.name || "Sin nombre"}</span>
                    <span className="text-xs text-muted-foreground">{d.address}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {setup?.kind === "usb" || setup?.kind === "serial" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={() =>
                void run("choose", async () => {
                  const name = setup.kind === "usb" ? await chooseUsbPrinter() : await chooseSerialPort()
                  save({ ...setup, name })
                })
              }
            >
              {busy === "choose" ? <Loader2 className="animate-spin" /> : <Search />}
              {setup.name ? "Elegir otra" : setup.kind === "usb" ? "Elegir impresora USB" : "Elegir puerto"}
            </Button>
            {setup.name ? <span className="text-sm">Elegida: <strong>{setup.name}</strong></span> : null}
          </div>
        ) : null}

        {setup?.kind === "bluetooth" && setup.name ? <p className="text-sm">Elegida: <strong>{setup.name}</strong></p> : null}

        {setup ? (
          <Button onClick={test} disabled={busy !== null}>
            {busy === "test" ? <Loader2 className="animate-spin" /> : <Printer />}
            Imprimir prueba
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

/** Impresoras de este aparato (Configuración, sección Impresoras). */
export function PrinterSettings({ food }: { food: boolean }) {
  const prefs = usePrinterPrefs()
  // Lo que puede usar este aparato solo se sabe en el navegador.
  const [kinds, setKinds] = React.useState<PrinterKind[] | null>(null)
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depende del navegador o la app, se lee al abrir
    setKinds(availableKinds())
  }, [])
  if (!kinds) return null
  const notes = missingNote(kinds)

  return (
    <div className="space-y-6">
      <p className="rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
        Esto se guarda <strong>en este aparato</strong>: configura cada celular, tablet o computador con la impresora que tiene cerca.
      </p>
      <PrinterCard role="cuenta" kinds={kinds} />
      {food ? (
        <>
          <PrinterCard role="cocina" kinds={kinds} />
          <Card>
            <CardHeader>
              <CardTitle>Cuándo sale la comanda</CardTitle>
              <CardDescription>Activa solo una de las dos, y en un solo aparato del local, para que la comanda no salga dos veces.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-start justify-between gap-4">
                <span className="text-sm">
                  <span className="font-medium">Al tocar “Enviar a cocina”</span>
                  <span className="block text-muted-foreground">Sale desde este aparato cuando aquí se envía un pedido (por ejemplo, la caja).</span>
                </span>
                <Switch
                  checked={Boolean(prefs.kitchenOnSend)}
                  disabled={!prefs.cocina}
                  onCheckedChange={(v) => setPrinterPrefs((p) => ({ ...p, kitchenOnSend: v }))}
                />
              </label>
              <label className="flex items-start justify-between gap-4">
                <span className="text-sm">
                  <span className="font-medium">Sola, en la pantalla de Cocina</span>
                  <span className="block text-muted-foreground">
                    Deja este aparato en la cocina con la pantalla Cocina abierta: imprime cada pedido nuevo, lo envíe quien lo envíe.
                  </span>
                </span>
                <Switch
                  checked={Boolean(prefs.kitchenAuto)}
                  disabled={!prefs.cocina}
                  onCheckedChange={(v) => setPrinterPrefs((p) => ({ ...p, kitchenAuto: v }))}
                />
              </label>
              {!prefs.cocina ? <p className="text-xs text-muted-foreground">Primero elige la impresora de cocina.</p> : null}
              {prefs.cocina?.kind === "dialog" ? (
                <p className="text-xs text-muted-foreground">
                  Con “Diálogo de impresión” se abre la ventana de impresión en cada comanda. Para que salga sola, usa red, USB, Bluetooth o puerto serie.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}
      {isWindows() && !isNativeApp() ? <KioskCard /> : null}
      {notes.length ? (
        <div className="space-y-1 rounded-xl border p-3 text-xs text-muted-foreground">
          {notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Windows: imprimir sin la ventana de impresión, en la impresora predeterminada (USB o de red con su driver). */
function KioskCard() {
  function download() {
    const blob = new Blob([kioskShortcut(window.location.origin)], { type: "application/octet-stream" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "OrdenSimple caja.cmd"
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Imprimir sin la ventana de impresión (Windows)</CardTitle>
        <CardDescription>Para la caja o la cocina con una impresora USB o de red instalada en Windows: cada boleta y comanda sale sola, sin Ctrl + P.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            Deja tu impresora térmica como <strong>predeterminada</strong>: Configuración de Windows, sección Bluetooth y dispositivos, Impresoras y escáneres. Apaga
            “Permitir que Windows administre mi impresora predeterminada”, entra a tu impresora y toca <strong>Establecer como predeterminada</strong>.
          </li>
          <li>Descarga el acceso directo y ábrelo. Si Windows avisa que es un archivo descargado, toca “Más información” y luego “Ejecutar de todas formas”.</li>
          <li>Se abre OrdenSimple en su propia ventana: inicia sesión una vez. Desde ahí todo se imprime directo.</li>
          <li>Aquí mismo, en esa ventana, elige “Impresora instalada en el computador” para las cuentas y para la cocina.</li>
        </ol>
        <Button variant="outline" onClick={download}>
          <Download />
          Descargar acceso directo
        </Button>
        <p className="text-xs text-muted-foreground">
          Copia el archivo al escritorio para abrir la caja siempre desde ahí. En las otras ventanas del navegador se sigue abriendo la ventana de impresión como siempre.
        </p>
      </CardContent>
    </Card>
  )
}
