import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"

// Imagen que aparece al compartir el link en WhatsApp, Facebook, LinkedIn, X, etc.
export const alt = "OrdenSimple — Administra tu negocio sin complicarte"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const GREEN = "#007653"
const AMBER = "#f2a649"
const INK = "#13201c"
const MUTED = "#5b6b66"

function Mark({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 64 64">
      <rect width="64" height="64" rx="15" fill={GREEN} />
      <rect x="14" y="36" width="9" height="14" rx="4.5" fill="#fff" />
      <rect x="27.5" y="28" width="9" height="22" rx="4.5" fill="#fff" />
      <rect x="41" y="26" width="9" height="24" rx="4.5" fill="#fff" />
      <circle cx="45.5" cy="17.5" r="4.5" fill={AMBER} />
    </svg>
  )
}

const BARS = [
  [62, 28],
  [48, 34],
  [74, 22],
  [58, 40],
  [88, 30],
  [96, 36],
  [70, 24],
]

async function loadFonts() {
  const dir = join(process.cwd(), "assets/fonts")
  const [regular, semibold, bold] = await Promise.all([
    readFile(join(dir, "Geist-Regular.ttf")),
    readFile(join(dir, "Geist-SemiBold.ttf")),
    readFile(join(dir, "Geist-Bold.ttf")),
  ])
  return [
    { name: "Geist", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Geist", data: semibold, weight: 600 as const, style: "normal" as const },
    { name: "Geist", data: bold, weight: 700 as const, style: "normal" as const },
  ]
}

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #f3faf6 0%, #e3f3ea 100%)",
          padding: "64px 72px",
          fontFamily: "Geist",
        }}
      >
        {/* Texto */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 560 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Mark s={64} />
            <div style={{ display: "flex", fontSize: 42, fontWeight: 600, color: INK, letterSpacing: -1 }}>
              <span style={{ marginRight: -1 }}>Orden</span>
              <span style={{ color: GREEN, marginLeft: -1 }}>Simple</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", fontSize: 66, fontWeight: 700, color: INK, lineHeight: 1.05, letterSpacing: -2.5 }}>
              Administra tu negocio sin complicarte.
            </div>
            <div style={{ display: "flex", fontSize: 28, color: MUTED, lineHeight: 1.35 }}>
              Ventas, gastos, productos y ganancias en un solo lugar.
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                background: GREEN,
                color: "#fff",
                fontSize: 24,
                fontWeight: 700,
                whiteSpace: "nowrap",
                padding: "14px 26px",
                borderRadius: 16,
              }}
            >
              Comenzar gratis
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                color: INK,
                fontSize: 20,
                whiteSpace: "nowrap",
                padding: "14px 22px",
                borderRadius: 16,
                border: "2px solid #c9ddd3",
                background: "#ffffffaa",
              }}
            >
              Hecho para pymes de Chile
            </div>
          </div>
        </div>

        {/* Vista del panel (datos de ejemplo) */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 470,
              background: "#fff",
              borderRadius: 28,
              padding: 28,
              gap: 18,
              boxShadow: "0 30px 60px rgba(0, 70, 50, 0.18)",
              border: "1px solid #dfe9e4",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#e5f4ec",
                borderRadius: 14,
                padding: "12px 16px",
                fontSize: 21,
                color: INK,
              }}
            >
              <div style={{ display: "flex", width: 16, height: 16, borderRadius: 8, background: "#1f9d55" }} />
              <span style={{ fontWeight: 700 }}>Vas bien.</span>
              <span style={{ color: MUTED }}>Tu negocio está ganando.</span>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              {[
                ["Ventas hoy", "$350.000"],
                ["Gastos", "$120.000"],
                ["Ganancia", "$230.000"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    gap: 6,
                    border: "1px solid #e3ebe7",
                    borderRadius: 16,
                    padding: "14px 14px",
                  }}
                >
                  <span style={{ fontSize: 16, color: MUTED }}>{label}</span>
                  <span style={{ fontSize: 24, fontWeight: 700, color: INK, letterSpacing: -0.5 }}>{value}</span>
                </div>
              ))}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                height: 150,
                border: "1px solid #e3ebe7",
                borderRadius: 16,
                padding: "16px 22px",
              }}
            >
              {BARS.map(([s, e], i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-end", gap: 4, height: "100%" }}>
                  <div style={{ display: "flex", width: 18, height: `${s}%`, background: GREEN, borderRadius: "6px 6px 0 0" }} />
                  <div style={{ display: "flex", width: 18, height: `${e}%`, background: "#e08a35", borderRadius: "6px 6px 0 0" }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  justifyContent: "center",
                  background: GREEN,
                  color: "#fff",
                  fontSize: 20,
                  fontWeight: 700,
                  padding: "13px 0",
                  borderRadius: 14,
                }}
              >
                Registrar venta
              </div>
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  justifyContent: "center",
                  color: INK,
                  fontSize: 20,
                  fontWeight: 700,
                  padding: "11px 0",
                  borderRadius: 14,
                  border: "2px solid #dfe9e4",
                }}
              >
                Registrar gasto
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await loadFonts() },
  )
}
