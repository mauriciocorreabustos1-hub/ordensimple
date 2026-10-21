"use client"

import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type DownloadOption = { label: string; href: string; format: "pdf" | "excel"; hint?: string }

/** Botón "Descargar" con las opciones en PDF y Excel, agrupadas. */
export function DownloadMenu({ groups, label = "Descargar" }: { groups: { title: string; options: DownloadOption[] }[]; label?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download />
          {label}
          <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {groups.map((g, i) => (
          <div key={g.title}>
            {i ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="text-xs text-muted-foreground">{g.title}</DropdownMenuLabel>
            {g.options.map((o) => (
              <DropdownMenuItem key={o.href} asChild>
                <a href={o.href} download className="flex items-start gap-2">
                  {o.format === "pdf" ? (
                    <FileText className="mt-0.5 size-4 text-red-600 dark:text-red-400" />
                  ) : (
                    <FileSpreadsheet className="mt-0.5 size-4 text-emerald-700 dark:text-emerald-400" />
                  )}
                  <span className="min-w-0">
                    <span className="block">{o.label}</span>
                    {o.hint ? <span className="block text-xs text-muted-foreground">{o.hint}</span> : null}
                  </span>
                </a>
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
