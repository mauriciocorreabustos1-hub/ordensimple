"use client"

import { Smartphone } from "lucide-react"
import { AndroidSteps, InAppBrowserNote, InstallButton, IphoneSteps, useInstallInfo } from "@/components/app/install-app"
import { cn } from "@/lib/utils"

/** Pasos para iPhone y Android; el del celular de la persona aparece primero y destacado. */
export function InstallGuide() {
  const info = useInstallInfo()
  const androidFirst = info?.platform === "android"
  const cards = [
    { id: "iphone", title: "En iPhone", icon: Smartphone, steps: <IphoneSteps /> },
    { id: "android", title: "En Android", icon: Smartphone, steps: <AndroidSteps /> },
  ]
  if (androidFirst) cards.reverse()

  return (
    <div className="space-y-6">
      {info?.installed ? (
        <p className="rounded-xl border border-success/30 bg-success/10 p-3 text-sm">Ya la tienes instalada: la estás usando como app. ✓</p>
      ) : null}
      {info?.inAppBrowser ? <InAppBrowserNote platform={info.platform} /> : null}
      <InstallButton />
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => {
          const mine = info?.platform === c.id
          return (
            <section
              key={c.id}
              className={cn("space-y-4 rounded-2xl border bg-card p-5 sm:p-6", mine && "border-primary/50 ring-1 ring-primary/30")}
            >
              <h2 className="font-display flex items-center gap-2 text-xl font-semibold">
                <c.icon className="size-5 text-primary" />
                {c.title}
                {mine ? <span className="text-sm font-normal text-muted-foreground">(tu celular)</span> : null}
              </h2>
              {c.steps}
            </section>
          )
        })}
      </div>
    </div>
  )
}
