import { AlertTriangle, Check, X } from "lucide-react"

/** Qué incluye y qué no el cálculo del IVA, en simple, para que el dueño sepa qué está mirando. */
export function VatCoverage({ label: L, chile, ppm, retention }: { label: string; chile: boolean; ppm: string | null; retention?: string }) {
  const included = [
    { title: `${L} de tus ventas`, text: "Todas: efectivo, débito, crédito, transferencia y fiado (en el mes en que vendes, aunque te paguen después)." },
    { title: `${L} de tus gastos con factura`, text: "Solo los que marcaste “con factura”, en el mes de la factura. Lo comprado con boleta no descuenta." },
    { title: "Gastos que nunca descuentan", text: "Sueldos, honorarios, impuestos, contribuciones, patentes, multas e intereses quedan fuera solos." },
    { title: `${L} a favor`, text: "Si un mes compraste más de lo que vendiste, se descuenta del mes siguiente." },
    ...(ppm ? [{ title: "PPM", text: `${ppm} de tus ventas sin ${L}. Lo cambias en Configuración.` }] : []),
    ...(chile
      ? [
          { title: "Retención de honorarios", text: `${retention ?? ""} del monto bruto de las boletas de honorarios en que marcaste “Yo retengo el impuesto”.` },
          { title: "Impuestos específicos", text: `El ILA o el impuesto a los combustibles que anotas en tus facturas no se descuentan como ${L}: quedan como costo.` },
        ]
      : []),
  ]
  const missing = chile
    ? [
        { title: "Consumo propio", text: `Lo que sacas del local para tu casa también paga ${L}.` },
        { title: "Notas de crédito", text: "Devoluciones o descuentos hechos con documento." },
        { title: `${L} postergado`, text: "La opción de las Pro Pyme de pagarlo hasta 2 meses después." },
      ]
    : [{ title: "Casos especiales", text: "Retenciones, notas de crédito u otros ajustes de tu país." }]
  const assumed = [
    `Que todo lo que vendes lleva ${L} y lo registras con boleta o factura. Si vendes algo exento o anotas ventas sin documento, el cálculo da más de lo real.`,
    "Que marcas bien qué gastos tienen factura: si olvidas uno, ese descuento no aparece.",
  ]

  return (
    <div className="mt-6 grid gap-4 border-t pt-5 text-sm md:grid-cols-2">
      <div className="space-y-2.5">
        <p className="font-semibold">Lo que incluye este cálculo</p>
        <ul className="space-y-2">
          {included.map((i) => (
            <li key={i.title} className="flex gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-success" />
              <span>
                <span className="font-medium">{i.title}:</span> <span className="text-muted-foreground">{i.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-4">
        <div className="space-y-2.5">
          <p className="font-semibold">Lo que no incluye (lo suma tu contador)</p>
          <ul className="space-y-2">
            {missing.map((i) => (
              <li key={i.title} className="flex gap-2.5">
                <X className="mt-0.5 size-4 shrink-0 text-danger" />
                <span>
                  <span className="font-medium">{i.title}:</span> <span className="text-muted-foreground">{i.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2 rounded-xl bg-warning/10 p-3">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4 text-warning" />
            Lo que suponemos
          </p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {assumed.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Es un cálculo aproximado para que el pago no te tome por sorpresa. La cifra oficial es la que confirma tu contador o el SII.
        </p>
      </div>
    </div>
  )
}
