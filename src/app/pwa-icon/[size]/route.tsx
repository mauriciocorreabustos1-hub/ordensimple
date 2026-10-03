import { ImageResponse } from "next/og"

const SIZES = new Set([180, 192, 512])

// Íconos PNG para el manifest PWA y la pantalla de inicio de iOS (mismo isotipo que public/brand).
export async function GET(_req: Request, { params }: RouteContext<"/pwa-icon/[size]">) {
  const { size: raw } = await params
  const size = Number(raw)
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 })
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#007653" }}>
        <svg width={size} height={size} viewBox="0 0 64 64">
          <rect x="14" y="36" width="9" height="14" rx="4.5" fill="#fff" />
          <rect x="27.5" y="28" width="9" height="22" rx="4.5" fill="#fff" />
          <rect x="41" y="26" width="9" height="24" rx="4.5" fill="#fff" />
          <circle cx="45.5" cy="17.5" r="4.5" fill="#f2a649" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  )
}
