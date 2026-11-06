"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Loader2, RotateCcw, Upload, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { csvCell, IMPORT_BATCH, IMPORT_MAX_BYTES, type ImportPreview, type ImportResult, type PreviewRow } from "@/lib/product-import"
import { importProductsBatch } from "@/server/actions/product-import"

type Stage = "elegir" | "revisar" | "importando" | "listo"

const STATUS: Record<PreviewRow["status"], { label: string; tone: string }> = {
  nuevo: { label: "Nuevo", tone: "bg-success/15 text-success" },
  existe: { label: "Ya existe", tone: "bg-chart-1/15 text-chart-1" },
  error: { label: "Con error", tone: "bg-danger/15 text-danger" },
  repetido: { label: "Repetido", tone: "bg-warning/15 text-warning" },
  limite: { label: "Sobre el límite", tone: "bg-warning/15 text-warning" },
  ejemplo: { label: "Ejemplo", tone: "bg-muted text-muted-foreground" },
}

/** Si la fila se puede elegir para importar (los nuevos, y los que ya existen y se reconocen por su código). */
const selectable = (r: PreviewRow) => r.status === "nuevo" || (r.status === "existe" && r.existing?.by === "codigo")

function rowNote(r: PreviewRow, money: (n: number) => string) {
  if (r.issues.length) return r.issues.map((i) => `${i.column}: ${i.message}`).join(" ")
  if (r.status === "repetido") return `Es el mismo producto de la fila ${r.duplicateOf}.`
  if (r.status === "limite") return "No cabe en los productos de tu plan."
  if (r.status === "ejemplo") return "Es la fila de ejemplo de la plantilla: no se importa."
  if (r.status === "existe" && r.existing)
    return r.existing.by === "codigo"
      ? `Es "${r.existing.name}" (${money(r.existing.price)}${r.existing.trackStock ? `, stock ${r.existing.stock}` : ""}).`
      : `Ya tienes "${r.existing.name}". Sin código no se puede actualizar: se omite.`
  return ""
}

/** Importar productos desde Excel o CSV: plantilla, revisión fila por fila y guardado por lotes. */
export function ProductImport({ currency, limit, current }: { currency: string; limit: number | null; current: number }) {
  const money = (n: number) => formatMoney(n, currency)
  const [stage, setStage] = React.useState<Stage>("elegir")
  const [file, setFile] = React.useState<File | null>(null)
  const [checking, setChecking] = React.useState(false)
  const [fileError, setFileError] = React.useState<string | null>(null)
  const [preview, setPreview] = React.useState<ImportPreview | null>(null)
  const [excluded, setExcluded] = React.useState<Set<number>>(new Set())
  const [updateExisting, setUpdateExisting] = React.useState(false)
  const [updateStock, setUpdateStock] = React.useState(false)
  const [filter, setFilter] = React.useState<"todos" | "importar" | "problemas">("todos")
  const [shown, setShown] = React.useState(100)
  const [results, setResults] = React.useState<ImportResult[]>([])
  const [progress, setProgress] = React.useState({ done: 0, total: 0 })
  const [failed, setFailed] = React.useState<string | null>(null)
  // Cuántos faltan por guardar (si la importación se cortó).
  const [remaining, setRemaining] = React.useState(0)
  const queue = React.useRef<{ row: number; data: NonNullable<PreviewRow["data"]> }[]>([])
  const running = React.useRef(false)
  const input = React.useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)

  // Mientras se guarda, avisar si intenta cerrar la página.
  React.useEffect(() => {
    if (stage !== "importando") return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [stage])

  function pick(f: File | undefined | null) {
    setFileError(null)
    if (!f) return
    const ext = f.name.toLowerCase().split(".").pop()
    if (ext !== "xlsx" && ext !== "csv") return setFileError("Sube un archivo .xlsx (Excel) o .csv.")
    if (f.size > IMPORT_MAX_BYTES) return setFileError("El archivo pesa más de 2 MB. Divídelo en varios archivos.")
    setFile(f)
  }

  async function check() {
    if (!file || checking) return
    setChecking(true)
    setFileError(null)
    try {
      const body = new FormData()
      body.append("archivo", file)
      const res = await fetch("/dashboard/productos/importar/revisar", { method: "POST", body })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json || "error" in json) return setFileError(json?.error ?? "No pudimos revisar el archivo.")
      const p = json as ImportPreview
      setPreview(p)
      setExcluded(new Set())
      setFilter("todos")
      setShown(100)
      setStage("revisar")
    } catch {
      setFileError("No hay conexión. Revisa tu internet y vuelve a intentarlo.")
    } finally {
      setChecking(false)
    }
  }

  const rows = preview?.rows ?? []
  const count = (s: PreviewRow["status"]) => rows.filter((r) => r.status === s).length
  const chosen = rows.filter((r) => selectable(r) && !excluded.has(r.row) && (r.status === "nuevo" || updateExisting))
  const visible = rows.filter((r) =>
    filter === "todos" ? true : filter === "importar" ? selectable(r) && !excluded.has(r.row) : r.status === "error" || r.status === "limite" || r.status === "repetido",
  )

  async function run() {
    if (running.current) return
    running.current = true
    setFailed(null)
    setStage("importando")
    try {
      while (queue.current.length) {
        const batch = queue.current.slice(0, IMPORT_BATCH)
        const res = await importProductsBatch({ rows: batch, updateExisting, updateStock: updateExisting && updateStock }).catch(() => null)
        if (!res || !res.ok) {
          setFailed(res && !res.ok ? res.message : "Se cortó la conexión.")
          return
        }
        queue.current = queue.current.slice(batch.length)
        setRemaining(queue.current.length)
        setResults((r) => [...r, ...(res.data?.results ?? [])])
        setProgress((p) => ({ ...p, done: p.done + batch.length }))
      }
      setStage("listo")
    } finally {
      running.current = false
    }
  }

  function start() {
    if (!chosen.length) return
    queue.current = chosen.map((r) => ({ row: r.row, data: r.data! }))
    setRemaining(queue.current.length)
    setResults([])
    setProgress({ done: 0, total: chosen.length })
    void run()
  }

  function reset() {
    setStage("elegir")
    setFile(null)
    setPreview(null)
    setResults([])
    setFailed(null)
    if (input.current) input.current.value = ""
  }

  /** CSV con las filas que no se importaron por un problema, para corregirlas en Excel. */
  function downloadErrors() {
    const lines = [["Fila", "Nombre", "Código", "Precio", "Problema"].join(";")]
    const fromServer = new Map(results.filter((r) => r.result === "error").map((r) => [r.row, r.message ?? "No se pudo guardar."]))
    for (const r of rows) {
      const problem = fromServer.get(r.row) ?? (r.status === "error" || r.status === "limite" || r.status === "repetido" ? rowNote(r, money) : null)
      if (problem) lines.push([r.row, r.raw.name, r.raw.codes, r.raw.price, problem].map(csvCell).join(";"))
    }
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "productos-con-errores.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const problems = count("error") + count("limite") + count("repetido")

  // ─── 1. Elegir archivo ───
  if (stage === "elegir")
    return (
      <div className="space-y-5">
        <ol className="grid gap-3 md:grid-cols-3">
          <li className="space-y-3 rounded-2xl border bg-card p-5">
            <p className="flex items-center gap-2 font-semibold">
              <span className="tabular flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">1</span>
              Descarga la plantilla
            </p>
            <p className="text-sm text-pretty text-muted-foreground">Un Excel con las columnas listas y una fila de ejemplo, que no se importa.</p>
            <Button variant="outline" className="min-h-10 w-full" asChild>
              <a href="/dashboard/productos/importar/plantilla" download>
                <Download />
                Descargar plantilla
              </a>
            </Button>
          </li>
          <li className="space-y-2 rounded-2xl border bg-card p-5">
            <p className="flex items-center gap-2 font-semibold">
              <span className="tabular flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">2</span>
              Llénala con tus productos
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-pretty text-muted-foreground">
              <li>Obligatorios: nombre y precio de venta (precio final, en {currency}).</li>
              <li>Los demás son opcionales: código, categoría, costo y stock.</li>
              <li>También sirve tu propia planilla si tiene columnas con esos nombres.</li>
            </ul>
          </li>
          <li className="space-y-2 rounded-2xl border bg-card p-5">
            <p className="flex items-center gap-2 font-semibold">
              <span className="tabular flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">3</span>
              Súbela y revisa
            </p>
            <p className="text-sm text-pretty text-muted-foreground">
              Antes de guardar te mostramos qué se va a crear, qué ya tienes y qué tiene errores. Nada se guarda hasta que confirmes.
            </p>
          </li>
        </ol>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            pick(e.dataTransfer.files[0])
          }}
          className={cn("space-y-4 rounded-2xl border-2 border-dashed bg-card p-6 text-center transition-colors", dragging ? "border-primary bg-accent/40" : "border-border")}
        >
          <FileSpreadsheet className="mx-auto size-10 text-primary" aria-hidden />
          {file ? (
            <div className="space-y-1">
              <p className="font-medium break-all">{file.name}</p>
              <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Arrastra aquí tu archivo .xlsx o .csv (hasta 2 MB y 5.000 productos), o elígelo.</p>
          )}
          <input ref={input} id="archivo-productos" type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <Button variant={file ? "outline" : "default"} size="lg" className="h-11" onClick={() => input.current?.click()} disabled={checking}>
              <Upload />
              {file ? "Elegir otro archivo" : "Elegir archivo"}
            </Button>
            {file ? (
              <Button size="lg" className="h-11" onClick={check} disabled={checking}>
                {checking ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                {checking ? "Revisando…" : "Revisar archivo"}
              </Button>
            ) : null}
          </div>
          {fileError ? (
            <p role="alert" className="mx-auto flex max-w-xl items-start justify-center gap-2 text-left text-sm text-danger">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {fileError}
            </p>
          ) : null}
        </div>
        {limit !== null ? (
          <p className="text-center text-xs text-muted-foreground">
            Tu plan permite {limit} productos y ya tienes {current}. Con Pro tienes productos ilimitados.
          </p>
        ) : null}
      </div>
    )

  // ─── 3. Guardando ───
  if (stage === "importando")
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border bg-card p-6 text-center">
        {failed ? <AlertTriangle className="mx-auto size-8 text-warning" /> : <Loader2 className="mx-auto size-8 animate-spin text-primary" />}
        <p className="font-semibold">{failed ? "La importación se detuvo" : "Importando productos…"}</p>
        <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} className="h-2" aria-label="Avance de la importación" />
        <p className="tabular text-sm text-muted-foreground" aria-live="polite">
          {progress.done} de {progress.total} revisados
        </p>
        {failed ? (
          <div className="space-y-3 text-sm">
            <p className="text-pretty">
              {failed} Los {progress.done} primeros ya quedaron guardados. Al reintentar se sigue con los que faltan, sin duplicar ninguno.
            </p>
            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              <Button onClick={() => void run()}>
                <RotateCcw />
                Reintentar
              </Button>
              <Button variant="ghost" onClick={() => setStage("listo")}>
                Ver lo que se guardó
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No cierres esta página hasta que termine.</p>
        )}
      </div>
    )

  // ─── 4. Resultado ───
  if (stage === "listo") {
    const by = (k: ImportResult["result"]) => results.filter((r) => r.result === k).length
    const errors = by("error") + count("error") + count("limite")
    const pending = remaining
    // Lo demás (repetidos, la fila de ejemplo, los que ya existían y no se actualizaron, los que se sacaron de la lista).
    const skipped = Math.max(0, rows.length - by("creado") - by("actualizado") - errors - pending)
    return (
      <div className="mx-auto max-w-xl space-y-5 rounded-2xl border bg-card p-6 sm:p-8">
        <div className="space-y-2 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="size-7" aria-hidden />
          </span>
          <h2 className="font-display text-2xl font-semibold tracking-tight">{pending ? "Importación incompleta" : "¡Importación completada!"}</h2>
          {pending ? <p className="text-sm text-muted-foreground">Faltaron {pending} por guardar. Vuelve a subir el mismo archivo: los ya creados aparecerán como existentes.</p> : null}
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Creados", by("creado"), "text-success"],
            ["Actualizados", by("actualizado"), "text-chart-1"],
            ["Omitidos", skipped, "text-muted-foreground"],
            ["Con errores", errors, errors ? "text-danger" : "text-muted-foreground"],
          ].map(([label, n, tone]) => (
            <div key={label as string} className="rounded-xl border p-3 text-center">
              <dd className={cn("tabular font-display text-2xl font-semibold", tone as string)}>{n as number}</dd>
              <dt className="text-xs text-muted-foreground">{label as string}</dt>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {errors || problems ? (
            <Button variant="outline" onClick={downloadErrors}>
              <Download />
              Descargar errores
            </Button>
          ) : null}
          <Button variant="outline" onClick={reset}>
            Importar otro archivo
          </Button>
          <Button asChild>
            <Link href="/dashboard/productos">Ver mis productos</Link>
          </Button>
        </div>
      </div>
    )
  }

  // ─── 2. Revisar ───
  const existing = count("existe")
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-sm">
          <FileSpreadsheet className="size-4 shrink-0 text-primary" />
          <span className="truncate font-medium">{preview?.fileName}</span>
          <span className="shrink-0 text-muted-foreground">· {rows.length} filas</span>
        </p>
        <Button variant="ghost" size="sm" onClick={() => setStage("elegir")}>
          <ArrowLeft />
          Volver
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {[
          ["Nuevos", count("nuevo"), "text-success"],
          ["Ya existen", existing, "text-chart-1"],
          ["Con errores", count("error"), count("error") ? "text-danger" : ""],
          ["Repetidos en el archivo", count("repetido"), count("repetido") ? "text-warning" : ""],
          ["Sobre el límite del plan", count("limite"), count("limite") ? "text-warning" : ""],
        ].map(([label, n, tone]) => (
          <div key={label as string} className="rounded-xl border bg-card p-3">
            <dd className={cn("tabular font-display text-2xl font-semibold", (tone as string) || "text-muted-foreground")}>{n as number}</dd>
            <dt className="text-xs text-muted-foreground">{label as string}</dt>
          </div>
        ))}
      </dl>

      {preview && (preview.ignoredColumns.length || preview.emptyRows || count("ejemplo")) ? (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {preview.ignoredColumns.length ? <li>Columnas que no se usan: {preview.ignoredColumns.join(", ")}.</li> : null}
          {preview.emptyRows ? <li>{preview.emptyRows === 1 ? "Se saltó 1 fila vacía." : `Se saltaron ${preview.emptyRows} filas vacías.`}</li> : null}
          {count("ejemplo") ? <li>La fila de ejemplo de la plantilla no se importa.</li> : null}
        </ul>
      ) : null}

      {existing ? (
        <fieldset className="space-y-3 rounded-2xl border bg-card p-4">
          <legend className="px-1 text-sm font-semibold">¿Qué hacemos con los {existing} productos que ya tienes?</legend>
          {[
            [false, "Omitirlos", "No se toca nada de lo que ya tienes."],
            [true, "Actualizar sus datos", "Nombre, precio, costo, categoría y stock mínimo, solo de los que tienen el mismo código de barras o SKU."],
          ].map(([value, label, hint]) => (
            <label key={String(value)} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3", updateExisting === value && "border-primary bg-accent/40")}>
              <input type="radio" name="existentes" className="mt-1 accent-[var(--primary)]" checked={updateExisting === value} onChange={() => setUpdateExisting(value as boolean)} />
              <span className="text-sm">
                <span className="block font-medium">{label as string}</span>
                <span className="block text-muted-foreground">{hint as string}</span>
              </span>
            </label>
          ))}
          {updateExisting ? (
            <label className="flex items-start gap-3 px-1 text-sm">
              <Checkbox checked={updateStock} onCheckedChange={(v) => setUpdateStock(v === true)} className="mt-0.5" />
              <span>
                <span className="font-medium">También reemplazar su stock por el del archivo.</span>
                <span className="block text-muted-foreground">Queda anotado como ajuste en el historial del inventario. Si no lo marcas, el stock no cambia.</span>
              </span>
            </label>
          ) : null}
        </fieldset>
      ) : null}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar filas">
        {(
          [
            ["todos", `Todas (${rows.length})`],
            ["importar", `Para importar (${chosen.length})`],
            ["problemas", `Con problemas (${problems})`],
          ] as const
        ).map(([k, label]) => (
          <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} className="rounded-full" aria-pressed={filter === k} onClick={() => (setFilter(k), setShown(100))}>
            {label}
          </Button>
        ))}
        {problems ? (
          <Button size="sm" variant="ghost" onClick={downloadErrors}>
            <Download />
            Descargar errores
          </Button>
        ) : null}
      </div>

      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {visible.slice(0, shown).map((r) => {
          const can = selectable(r)
          const on = can && !excluded.has(r.row) && (r.status === "nuevo" || updateExisting)
          const note = rowNote(r, money)
          return (
            <li key={r.row} className={cn("grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 px-4 py-3 sm:grid-cols-[auto_3rem_minmax(0,1fr)_8rem_6rem_7.5rem] sm:items-center", !on && "bg-muted/30")}>
              <Checkbox
                checked={on}
                disabled={!can || (r.status === "existe" && !updateExisting)}
                aria-label={`Importar fila ${r.row}: ${r.raw.name || "sin nombre"}`}
                onCheckedChange={(v) =>
                  setExcluded((s) => {
                    const n = new Set(s)
                    if (v === true) n.delete(r.row)
                    else n.add(r.row)
                    return n
                  })
                }
                className="row-span-2 mt-0.5 sm:row-span-1 sm:mt-0"
              />
              <span className="tabular hidden text-xs text-muted-foreground sm:block">{r.row}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  <span className="tabular mr-1.5 text-xs font-normal text-muted-foreground sm:hidden">Fila {r.row}</span>
                  {r.raw.name || "Sin nombre"}
                </span>
                {r.raw.codes || r.data?.categoryName ? (
                  <span className="block truncate text-xs text-muted-foreground">{[r.raw.codes, r.data?.categoryName].filter(Boolean).join(" · ")}</span>
                ) : null}
                {note ? <span className={cn("block text-xs text-pretty", r.status === "error" ? "text-danger" : "text-muted-foreground")}>{note}</span> : null}
              </span>
              <span className="tabular col-start-2 text-sm sm:col-start-auto sm:text-right">
                {r.data ? money(r.data.price) : r.raw.price || "—"}
                {r.data?.stock !== undefined ? <span className="text-xs text-muted-foreground sm:block"> · stock {r.data.stock}</span> : null}
              </span>
              <span className="hidden sm:block" />
              <span className={cn("col-start-2 w-fit rounded-full px-2 py-0.5 text-xs font-medium sm:col-start-auto sm:justify-self-end", STATUS[r.status].tone)}>{STATUS[r.status].label}</span>
            </li>
          )
        })}
        {visible.length === 0 ? <li className="px-4 py-8 text-center text-sm text-muted-foreground">No hay filas en este filtro.</li> : null}
      </ul>
      {visible.length > shown ? (
        <div className="text-center">
          <Button variant="outline" onClick={() => setShown((n) => n + 200)}>
            Mostrar más ({visible.length - shown} restantes)
          </Button>
        </div>
      ) : null}

      {/* En el celular queda sobre la barra de abajo de la app (4 rem de alto). */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex flex-col-reverse gap-1 border-t bg-background/95 px-4 py-2 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:rounded-2xl sm:border sm:px-4 sm:py-3 lg:bottom-0">
        <Button variant="ghost" onClick={reset}>
          <X />
          Cancelar importación
        </Button>
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <Button
            size="lg"
            className="h-11"
            disabled={!chosen.length}
            onClick={() => {
              if (!chosen.length) return toast.error("No hay productos para importar.")
              start()
            }}
          >
            <Upload />
            Importar {chosen.length} {chosen.length === 1 ? "producto" : "productos"}
          </Button>
          <p className="text-center text-xs text-muted-foreground sm:text-right">
            {chosen.filter((r) => r.status === "nuevo").length} nuevos{updateExisting ? ` · ${chosen.filter((r) => r.status === "existe").length} se actualizan` : ""}
          </p>
        </div>
      </div>
    </div>
  )
}
