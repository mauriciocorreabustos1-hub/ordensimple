"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useQuickActions } from "@/components/app/quick-actions"

export function OpenQuickAction({ action, label }: { action: "sale" | "expense"; label: string }) {
  const { open } = useQuickActions()
  return (
    <Button size="lg" className="h-10 px-4" onClick={() => open(action)}>
      <Plus />
      {label}
    </Button>
  )
}
