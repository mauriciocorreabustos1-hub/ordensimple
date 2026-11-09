"use client"

import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const IPHONE = [
  "Abre tu tarjeta en Safari.",
  "Toca el botón de los tres puntos, abajo a la derecha, y luego Compartir. En versiones anteriores del iPhone, Compartir está directo en la barra de abajo.",
  "Baja en la lista, toca Ver más si hace falta, y elige “Agregar a pantalla de inicio”.",
  "Deja activada la opción “Abrir como app web”.",
  "Toca Agregar. Tu tarjeta queda con su propio ícono en la pantalla de inicio.",
]

const ANDROID = [
  "Abre tu tarjeta en Chrome.",
  "Toca el menú de los tres puntos, arriba a la derecha.",
  "Elige “Instalar aplicación” o “Agregar a la pantalla principal”.",
  "Confirma con Instalar. Tu tarjeta queda con su propio ícono.",
]

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="list-decimal space-y-2.5 pl-5 text-sm text-pretty marker:font-semibold marker:text-primary">
      {steps.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ol>
  )
}

/** Cómo dejar la tarjeta como app. En Android, si el navegador lo permite, se instala con un botón. */
export function InstallGuide({ defaultTab = "iphone", onInstall }: { defaultTab?: "iphone" | "android"; /** Solo llega si Android ofreció la instalación directa. */ onInstall?: () => void }) {
  return (
    <Tabs defaultValue={defaultTab} className="gap-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="iphone">iPhone</TabsTrigger>
        <TabsTrigger value="android">Android</TabsTrigger>
      </TabsList>
      <TabsContent value="iphone" className="space-y-3">
        <Steps steps={IPHONE} />
        <p className="text-xs text-pretty text-muted-foreground">Si no ves la opción, revisa que la tarjeta esté abierta en Safari.</p>
      </TabsContent>
      <TabsContent value="android" className="space-y-4">
        {onInstall ? (
          <Button type="button" size="lg" className="h-12 w-full" onClick={onInstall}>
            <Download />
            Instalar ahora
          </Button>
        ) : null}
        <Steps steps={ANDROID} />
      </TabsContent>
    </Tabs>
  )
}
