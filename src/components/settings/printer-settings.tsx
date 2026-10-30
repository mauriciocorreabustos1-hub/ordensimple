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
import { DESKTOP_DOWNLOAD_URL } from "@/lib/desktop"
import { desktopBridge, isNativeApp } from "@/lib/native-app"
import { kitchenTicket } from "@/lib/kitchen-ticket"
import { Ticket } from "@/lib/ticket"
import {
  availableKinds,
  chooseSerialPort,
  chooseUsbPrinter,
  isWindows,
  kioskShortcut,
  listDesktopPrinters,
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
  // En la app de PC están todas las de Windows y las de red: no hay nada que explicar.
  if (desktopBridge()) return notes
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

        {setup?.kind === "desktop" ? <DesktopPrinterPicker setup={setup} save={save} /> : null}

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
      {isWindows() && !isNativeApp() && !desktopBridge() ? (
        <>
          <DesktopAppCard />
          <KioskCard />
        </>
      ) : null}
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
        <CardTitle>Sin instalar nada: imprimir sin la ventana de impresión</CardTitle>
        <CardDescription>Si prefieres no instalar la app para PC: un acceso directo que abre OrdenSimple en Chrome o Edge y manda todo a la impresora predeterminada de Windows.</CardDescription>
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

/** App de PC: elegir entre las impresoras instaladas en Windows. */
function DesktopPrinterPicker({ setup, save }: { setup: PrinterSetup; save: (s: PrinterSetup) => void }) {
  const [list, setList] = React.useState<{ name: string; displayName: string; isDefault: boolean }[] | null>(null)
  React.useEffect(() => {
    let alive = true
    listDesktopPrinters()
      .then((l) => alive && setList(l))
      .catch(() => alive && setList([]))
    return () => {
      alive = false
    }
  }, [])
  if (!list) return <p className="text-sm text-muted-foreground">Buscando impresoras…</p>
  if (!list.length) return <p className="text-sm text-muted-foreground">No hay impresoras instaladas en este PC. Instálala en Windows y vuelve a abrir esta pantalla.</p>
  return (
    <div className="space-y-3">
      <Field label="Impresora" htmlFor="printer-desktop-name">
        <select
          id="printer-desktop-name"
          value={setup.name ?? ""}
          onChange={(e) => save({ ...setup, name: e.target.value || undefined })}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Elige una impresora</option>
          {list.map((p) => (
            <option key={p.name} value={p.name}>
              {p.displayName}
              {p.isDefault ? " (predeterminada)" : ""}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={Boolean(setup.page)} onChange={(e) => save({ ...setup, page: e.target.checked })} className="mt-0.5 size-4 accent-primary" />
        <span>
          No es una impresora térmica de boletas
          <span className="block text-xs text-muted-foreground">Se imprime como página (por ejemplo, en una impresora de tinta o láser). Las térmicas no lo necesitan: así cortan el papel solas.</span>
        </span>
      </label>
    </div>
  )
}

/** Windows en el navegador: lo recomendado es la app para PC, que imprime directo en cualquier impresora. */
function DesktopAppCard() {
  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle>Recomendado en Windows: OrdenSimple para PC</CardTitle>
        <CardDescription>
          Imprime directo, sin la ventana de impresión, en la impresora que elijas (USB o de red), y la térmica corta el papel sola. Una para cuentas y otra para la
          cocina.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button asChild>
          <a href={DESKTOP_DOWNLOAD_URL}>
            <Download />
            Descargar para Windows
          </a>
        </Button>
        <a href="/descargar" className="text-sm text-primary underline-offset-2 hover:underline">
          Cómo instalarla
        </a>
      </CardContent>
    </Card>
  )
}
