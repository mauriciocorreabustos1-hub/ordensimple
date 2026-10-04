"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { acceptInvitation } from "@/server/actions/team"

export function AcceptInvitationButton({ token, businessName }: { token: string; businessName: string }) {
  const [pending, startTransition] = React.useTransition()
  return (
    <Button
      size="lg"
      className="h-11 w-full text-base"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          // Si todo sale bien, la acción redirige al panel del negocio.
          const r = await acceptInvitation(token)
          if (r && !r.ok) toast.error(r.message)
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : null}
      Unirme a {businessName}
    </Button>
  )
}
