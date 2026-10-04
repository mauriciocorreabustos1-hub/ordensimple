import { unsubscribeUser } from "@/server/unsubscribe"

// Baja con un clic desde Gmail/Outlook (cabecera List-Unsubscribe-Post, RFC 8058).
export async function POST(request: Request) {
  const url = new URL(request.url)
  const ok = await unsubscribeUser(url.searchParams.get("u"), url.searchParams.get("t"))
  return new Response(null, { status: ok ? 200 : 400 })
}
