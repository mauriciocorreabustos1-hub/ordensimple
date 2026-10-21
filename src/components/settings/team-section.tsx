"use client"

import * as React from "react"
import { Copy, Loader2, LogOut, MessageCircle, MoreVertical, Store, UserMinus, UserPlus, UserCog, X } from "lucide-react"
import { toast } from "sonner"
import type { Role } from "@/generated/prisma/enums"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { AppModal } from "@/components/app/app-modal"
import { Field } from "@/components/app/field"
import { initials } from "@/components/app/user-menu"
import { ChoiceChips } from "@/components/admin/choice-chips"
import { ROLE_LABEL } from "@/lib/roles"
import { whatsappLink } from "@/lib/whatsapp"
import { cancelInvitation, changeMemberRole, inviteMember, leaveBusiness, removeMember, setMemberBranches } from "@/server/actions/team"

type TeamRole = "ADMIN" | "EMPLOYEE"

export type TeamMember = { id: string; userId: string; name: string; email: string; role: Role; isMe: boolean; branchIds: string[] }
/** Sucursales de las que el dueño puede dar acceso. */
export type Branch = { id: string; name: string }

/** Casillas para elegir sucursales. */
function BranchPicker({ branches, value, onChange }: { branches: Branch[]; value: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div className="grid gap-2">
      {branches.map((b) => {
        const checked = value.includes(b.id)
        return (
          <label
            key={b.id}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${checked ? "border-primary bg-primary/5" : ""}`}
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => onChange(v === true ? [...value, b.id] : value.filter((id) => id !== b.id))}
            />
            <Store className="size-4 text-muted-foreground" />
            <span className="font-medium">{b.name}</span>
          </label>
        )
      })}
    </div>
  )
}
export type TeamInvitation = { id: string; email: string; role: Role; url: string; expiresLabel: string; branchName?: string }

const ROLE_HELP: Record<TeamRole, string> = {
  ADMIN: "Puede registrar, editar y borrar ventas y gastos, manejar productos, ver reportes y cambiar la configuración.",
  EMPLOYEE: "Puede registrar ventas y gastos, el inventario y los clientes. No ve reportes ni puede borrar registros.",
}

function whatsappUrl(businessName: string, url: string) {
  const text = `Te invité a ${businessName} en OrdenSimple para que registres ventas y gastos. Entra aquí: ${url}`
  return whatsappLink(null, text)
}

function copy(url: string) {
  void navigator.clipboard?.writeText(url)
  toast.success("Enlace copiado")
}

function ShareLink({ url, businessName }: { url: string; businessName: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" onClick={() => copy(url)}>
        <Copy />
        Copiar enlace
      </Button>
      <Button type="button" size="sm" variant="outline" asChild>
        <a href={whatsappUrl(businessName, url)} target="_blank" rel="noopener noreferrer">
          <MessageCircle />
          Enviar por WhatsApp
        </a>
      </Button>
    </div>
  )
}

function InviteDialog({
  businessName,
  disabledReason,
  branches,
  currentBranchId,
}: {
  businessName: string
  disabledReason: string | null
  branches: Branch[]
  currentBranchId: string
}) {
  const [open, setOpen] = React.useState(false)
  const [branchIds, setBranchIds] = React.useState<string[]>([currentBranchId])
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState<TeamRole>("EMPLOYEE")
  const [error, setError] = React.useState<string | undefined>()
  const [sentUrl, setSentUrl] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  function openDialog() {
    if (disabledReason) return void toast.info(disabledReason)
    setEmail("")
    setRole("EMPLOYEE")
    setBranchIds([currentBranchId])
    setError(undefined)
    setSentUrl(null)
    setOpen(true)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (branches.length > 1 && branchIds.length === 0) return setError("Elige al menos una sucursal")
    startTransition(async () => {
      const r = await inviteMember({ email, role, businessIds: branches.length > 1 ? branchIds : undefined })
      if (!r.ok) {
        setError(r.fieldErrors?.email?.[0] ?? r.message)
        return
      }
      toast.success(r.message ?? "Invitación enviada")
      setSentUrl(r.data?.url ?? null)
    })
  }

  return (
    <>
      <Button variant="outline" onClick={openDialog}>
        <UserPlus />
        Invitar usuario
      </Button>
      <AppModal
        open={open}
        onOpenChange={setOpen}
        title={sentUrl ? "¡Invitación enviada!" : "Invitar a tu equipo"}
        description={
          sentUrl
            ? `Le enviamos un correo a ${email}. También puedes mandarle el enlace por WhatsApp.`
            : "Le llegará un correo con un enlace para unirse. Si no tiene cuenta, la crea en un minuto."
        }
      >
        {sentUrl ? (
          <div className="grid gap-4">
            <p className="rounded-xl bg-muted px-4 py-3 text-sm break-all">{sentUrl}</p>
            <ShareLink url={sentUrl} businessName={businessName} />
            <p className="text-xs text-muted-foreground">
              El enlace vale por 7 días y solo funciona con el correo {email}.
            </p>
            <Button size="lg" className="h-11 text-base" onClick={() => setOpen(false)}>
              Listo
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-5">
            <Field label="Correo de la persona" htmlFor="inv-email" error={error}>
              <Input
                id="inv-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(undefined)
                }}
                placeholder="nombre@correo.cl"
                className="h-10"
                autoFocus
              />
            </Field>
            <Field label="¿Qué podrá hacer?" hint={ROLE_HELP[role]}>
              <ChoiceChips
                options={[
                  { value: "EMPLOYEE", label: "Empleado" },
                  { value: "ADMIN", label: "Administrador" },
                ]}
                value={role}
                onChange={setRole}
              />
            </Field>
            {branches.length > 1 ? (
              <Field label="¿A qué sucursales puede entrar?" hint="Solo verá las sucursales que marques. Puedes cambiarlo después.">
                <BranchPicker branches={branches} value={branchIds} onChange={setBranchIds} />
              </Field>
            ) : null}
            <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Enviar invitación
            </Button>
          </form>
        )}
      </AppModal>
    </>
  )
}

function useRun() {
  const [pending, startTransition] = React.useTransition()
  const run = (fn: () => Promise<{ ok: boolean; message?: string } | void>) =>
    startTransition(async () => {
      const r = await fn()
      if (!r) return
      if (r.ok) toast.success(r.message ?? "Listo")
      else toast.error(r.message ?? "No se pudo")
    })
  return { pending, run }
}

function MemberActions({ member, branches }: { member: TeamMember; branches: Branch[] }) {
  const { pending, run } = useRun()
  const other: TeamRole = member.role === "ADMIN" ? "EMPLOYEE" : "ADMIN"
  const [branchesOpen, setBranchesOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<string[]>(member.branchIds)
  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={`Opciones de ${member.name}`} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <MoreVertical />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => run(() => changeMemberRole(member.id, other))}>
          <UserCog />
          Cambiar a {ROLE_LABEL[other]}
        </DropdownMenuItem>
        {branches.length > 1 ? (
          <DropdownMenuItem
            onSelect={() => {
              setSelected(member.branchIds)
              setBranchesOpen(true)
            }}
          >
            <Store />
            Cambiar sucursales
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            if (window.confirm(`¿Quitar a ${member.name} del negocio? Ya no podrá entrar. Lo que registró se mantiene.`)) {
              run(() => removeMember(member.id))
            }
          }}
        >
          <UserMinus />
          Quitar del negocio
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <AppModal
      open={branchesOpen}
      onOpenChange={setBranchesOpen}
      title={`Sucursales de ${member.name}`}
      description="Marca las sucursales a las que puede entrar. No verá las demás."
    >
      <form
        className="grid gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (selected.length === 0) return void toast.error("Marca al menos una sucursal")
          run(async () => {
            const r = await setMemberBranches({ userId: member.userId, businessIds: selected })
            if (r.ok) setBranchesOpen(false)
            return r
          })
        }}
      >
        <BranchPicker branches={branches} value={selected} onChange={setSelected} />
        <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Guardar
        </Button>
      </form>
    </AppModal>
    </>
  )
}

function InvitationRow({ invitation, businessName, showBranch }: { invitation: TeamInvitation; businessName: string; showBranch: boolean }) {
  const { pending, run } = useRun()
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{invitation.email}</p>
        <p className="text-xs text-muted-foreground">
          {ROLE_LABEL[invitation.role]}
          {showBranch && invitation.branchName ? ` · ${invitation.branchName}` : ""} · esperando que acepte · vence el {invitation.expiresLabel}
        </p>
      </div>
      <div className="flex gap-1">
        <Button size="icon-sm" variant="ghost" aria-label="Copiar enlace de invitación" onClick={() => copy(invitation.url)}>
          <Copy />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Enviar invitación por WhatsApp" asChild>
          <a href={whatsappUrl(businessName, invitation.url)} target="_blank" rel="noopener noreferrer">
            <MessageCircle />
          </a>
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Cancelar invitación"
          className="text-destructive"
          disabled={pending}
          onClick={() => run(() => cancelInvitation(invitation.id))}
        >
          {pending ? <Loader2 className="animate-spin" /> : <X />}
        </Button>
      </div>
    </li>
  )
}

export function TeamSection({
  members,
  invitations,
  businessName,
  canManage,
  isOwner,
  limit,
  planName,
  branches,
  currentBranchId,
}: {
  members: TeamMember[]
  invitations: TeamInvitation[]
  businessName: string
  canManage: boolean
  isOwner: boolean
  limit: number
  planName: string
  branches: Branch[]
  currentBranchId: string
}) {
  const { pending, run } = useRun()
  const used = members.length + invitations.length
  const multi = branches.length > 1
  const disabledReason =
    !multi && used >= limit
      ? limit <= 1
        ? `El plan ${planName} es para una sola persona. Con Pro puedes sumar a tu equipo.`
        : `Tu plan permite hasta ${limit - 1} trabajadores. Quita a alguien o cancela una invitación para invitar a otra.`
      : null

  return (
    <div className="space-y-4">
      <ul className="divide-y">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-3">
            <Avatar className="size-9">
              <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">{initials(m.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {m.name}
                {m.isMe ? <span className="font-normal text-muted-foreground"> (tú)</span> : null}
              </p>
              <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              {branches.length > 1 && m.role !== "OWNER" ? (
                <p className="truncate text-xs text-muted-foreground">
                  <Store className="mr-1 inline size-3" />
                  {branches
                    .filter((b) => m.branchIds.includes(b.id))
                    .map((b) => b.name)
                    .join(", ")}
                </p>
              ) : null}
            </div>
            <Badge variant={m.role === "OWNER" ? "default" : "secondary"}>{ROLE_LABEL[m.role]}</Badge>
            {canManage && m.role !== "OWNER" ? <MemberActions member={m} branches={branches} /> : null}
          </li>
        ))}
        {canManage
          ? invitations.map((inv) => <InvitationRow key={inv.id} invitation={inv} businessName={businessName} showBranch={branches.length > 1} />)
          : null}
      </ul>
      <Separator />
      {canManage ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {multi
              ? `${members.length - 1} persona${members.length - 1 === 1 ? "" : "s"} en tu equipo, en ${branches.length} sucursales. Hasta ${limit - 1} trabajadores por sucursal en tu plan ${planName}.`
              : `${used - 1} de ${limit - 1} trabajador${limit - 1 === 1 ? "" : "es"} en tu plan ${planName}. Invita a administradores o empleados para que registren ventas y gastos.`}
          </p>
          <InviteDialog businessName={businessName} disabledReason={disabledReason} branches={branches} currentBranchId={currentBranchId} />
        </div>
      ) : !isOwner ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Solo el dueño puede invitar o quitar personas.</p>
          <Button
            variant="outline"
            className="text-destructive"
            disabled={pending}
            onClick={() => {
              if (window.confirm(`¿Salir de ${businessName}? Necesitarás una nueva invitación para volver.`)) {
                run(() => leaveBusiness())
              }
            }}
          >
            {pending ? <Loader2 className="animate-spin" /> : <LogOut />}
            Salir de este negocio
          </Button>
        </div>
      ) : null}
    </div>
  )
}
