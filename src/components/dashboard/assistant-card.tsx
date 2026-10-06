"use client"

import * as React from "react"
import { ArrowUp, Loader2, RotateCcw, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type Message = { role: "user" | "assistant"; content: string }

/** Negritas (**así**) dentro de una línea. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <React.Fragment key={i}>{part}</React.Fragment>,
      )}
    </>
  )
}

/** Respuesta con párrafos y listas simples ("- "). */
function Answer({ text }: { text: string }) {
  const blocks: React.ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={blocks.length} className="list-disc space-y-0.5 pl-5">
          {list.map((l, i) => (
            <li key={i}>
              <Inline text={l} />
            </li>
          ))}
        </ul>,
      )
      list = []
    }
  }
  for (const line of text.split("\n")) {
    const item = line.match(/^\s*[-•*]\s+(.*)/)
    if (item) list.push(item[1])
    else {
      flush()
      if (line.trim())
        blocks.push(
          <p key={blocks.length}>
            <Inline text={line.replace(/^#+\s*/, "")} />
          </p>,
        )
    }
  }
  flush()
  return <div className="space-y-2">{blocks}</div>
}

/** "Pregúntale a OrdenSimple": chat con IA que conoce la app y los números del negocio. */
export function AssistantCard({ suggestions, questionsLeft, trial }: { suggestions: string[]; questionsLeft: number; trial: boolean }) {
  const [messages, setMessages] = React.useState<Message[]>([])
  const [input, setInput] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [left, setLeft] = React.useState(questionsLeft)
  const endRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [messages])

  async function ask(question: string) {
    const q = question.trim()
    if (!q || pending) return
    const history: Message[] = [...messages, { role: "user", content: q }]
    setMessages([...history, { role: "assistant", content: "" }])
    setInput("")
    setPending(true)
    const show = (content: string) => setMessages([...history, { role: "assistant", content }])
    try {
      const res = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      })
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null)
        show(data?.message ?? "No pude responder ahora. Intenta de nuevo en un rato.")
        if (res.status === 429) setLeft(0)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let text = ""
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        show(text)
      }
      if (!text.trim()) show("No pude responder ahora. Intenta de nuevo en un rato.")
      else setLeft((n) => Math.max(0, n - 1))
    } catch {
      show("Se cortó la conexión. Revisa tu internet e intenta de nuevo.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Pregúntale a OrdenSimple
            <Badge variant="secondary">{trial ? "Prueba" : "Nuevo"}</Badge>
          </CardTitle>
          <CardDescription>Dudas de la app o de tus números: cómo vas, quién te debe, qué reponer, tu IVA…</CardDescription>
        </div>
        {messages.length ? (
          <Button variant="ghost" size="icon-sm" onClick={() => setMessages([])} disabled={pending} aria-label="Empezar de nuevo" title="Empezar de nuevo">
            <RotateCcw />
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {messages.length ? (
          <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1 text-sm" aria-live="polite">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <p key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-primary-foreground">
                  {m.content}
                </p>
              ) : (
                <div key={i} className="w-fit max-w-[92%] rounded-2xl rounded-bl-md bg-muted/60 px-3.5 py-2.5 leading-relaxed">
                  {m.content ? (
                    <Answer text={m.content} />
                  ) : (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Pensando…
                    </span>
                  )}
                </div>
              ),
            )}
            <div ref={endRef} />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                disabled={left <= 0}
                className="rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/50 hover:bg-accent disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void ask(input)
          }}
          className="flex items-end gap-2"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void ask(input)
              }
            }}
            placeholder={left > 0 ? "Escribe tu pregunta…" : "Llegaste al límite de hoy"}
            disabled={left <= 0}
            rows={1}
            maxLength={1000}
            className="max-h-32 min-h-10 resize-none"
            aria-label="Tu pregunta"
          />
          <Button type="submit" size="icon" className="size-10 shrink-0" disabled={pending || !input.trim() || left <= 0} aria-label="Enviar pregunta">
            {pending ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          </Button>
        </form>
        <p className={cn("text-xs text-muted-foreground", left <= 5 && "text-warning")}>
          Respuestas con IA a partir de tus datos: revisa lo importante. Te quedan {left} {left === 1 ? "pregunta" : "preguntas"} hoy.
        </p>
      </CardContent>
    </Card>
  )
}
