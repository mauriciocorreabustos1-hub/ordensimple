"use client"

import * as React from "react"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { addAdminNote, deleteAdminNote } from "@/server/actions/admin"

export type AdminNoteRow = { id: string; text: string; author: string; when: string }

const IDEAS = ["Lo llamé", "Interesado en Pro", "Pidió una función", "Tuvo un problema"]

/** Notas internas sobre un usuario: solo las ven los administradores. */
export function AdminNotes({ userId, notes }: { userId: string; notes: AdminNoteRow[] }) {
  const [text, setText] = React.useState("")
  const [pending, startTransition] = React.useTransition()

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (text.trim().length < 2) return
    startTransition(async () => {
      const r = await addAdminNote({ userId, text })
      if (!r.ok) return void toast.error(r.message)
      toast.success(r.message ?? "Nota guardada")
      setText("")
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="space-y-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ej: Lo llamé, le interesa Pro pero espera fin de mes. Pidió venta por peso."
          maxLength={1000}
          rows={3}
          aria-label="Nueva nota"
        />
        <div className="flex flex-wrap items-center gap-2">
          {IDEAS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setText((t) => (t ? `${t} ${i}.` : `${i}: `))}
              className="rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
            >
              {i}
            </button>
          ))}
          <Button type="submit" size="sm" className="ml-auto" disabled={pending || text.trim().length < 2}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Guardar nota
          </Button>
        </div>
      </form>
      {notes.length ? (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="group flex gap-3 rounded-xl border bg-warning/5 p-3 text-sm">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="whitespace-pre-wrap">{n.text}</p>
                <p className="text-xs text-muted-foreground">
                  {n.when} · {n.author}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                aria-label="Borrar nota"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm("¿Borrar esta nota?")) return
                  startTransition(async () => {
                    const r = await deleteAdminNote(n.id)
                    if (r.ok) toast.success(r.message ?? "Nota borrada")
                    else toast.error(r.message)
                  })
                }}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Aún no hay notas sobre esta persona.</p>
      )}
    </div>
  )
}
