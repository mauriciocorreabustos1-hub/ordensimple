/**
 * De dónde llega cada persona: el enlace del anuncio (?utm_source=instagram&utm_campaign=escanear) o la página que
 * la trajo. El navegador lo guarda en una cookie la primera vez que entra (script en src/app/layout.tsx) y al
 * registrarse se copia a su cuenta.
 */
export const ORIGIN_COOKIE = "os_origen"

/** Guarda el origen la primera vez (60 días). JavaScript antiguo a propósito: corre en cualquier navegador. */
export const ORIGIN_SCRIPT = `(function(){try{if(document.cookie.indexOf("${ORIGIN_COOKIE}=")>-1)return;var q=new URLSearchParams(location.search);var s=q.get("utm_source")||q.get("ref")||q.get("fbclid")&&"facebook"||q.get("gclid")&&"google"||"";var r="";try{var h=document.referrer?new URL(document.referrer).hostname:"";if(h&&h!==location.hostname)r=h}catch(e){}if(!s&&!r)return;var v=[s,q.get("utm_medium")||"",q.get("utm_campaign")||"",r].map(function(x){return encodeURIComponent(String(x).slice(0,60))}).join("|");document.cookie="${ORIGIN_COOKIE}="+v+";path=/;max-age=5184000;samesite=lax"}catch(e){}})()`

const clean = (v: string | undefined) => {
  const s = (v ?? "").trim().toLowerCase().slice(0, 60)
  return /^[\w .:/@+-]+$/.test(s) ? s : null
}

/** Lee la cookie de origen desde el encabezado Cookie. */
export function parseOrigin(cookieHeader: string | null | undefined) {
  const raw = cookieHeader
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${ORIGIN_COOKIE}=`))
    ?.slice(ORIGIN_COOKIE.length + 1)
  if (!raw) return null
  let parts: string[]
  try {
    parts = decodeURIComponent(raw).split("|").map((p) => decodeURIComponent(p))
  } catch {
    return null
  }
  const [source, medium, campaign, referrer] = parts
  const out = { signupSource: clean(source), signupMedium: clean(medium), signupCampaign: clean(campaign), signupReferrer: clean(referrer) }
  // Sin utm_source, la página de donde vino sirve de origen (ej. l.instagram.com → instagram).
  if (!out.signupSource && out.signupReferrer) out.signupSource = sourceFromHost(out.signupReferrer)
  return out.signupSource || out.signupReferrer ? out : null
}

function sourceFromHost(host: string) {
  for (const [name, re] of [
    ["instagram", /instagram/],
    ["facebook", /facebook|fb\.com|fb\.me/],
    ["tiktok", /tiktok/],
    ["google", /google\./],
    ["whatsapp", /whatsapp|wa\.me/],
    ["youtube", /youtube|youtu\.be/],
  ] as const) {
    if (re.test(host)) return name
  }
  return host
}

/** Nombre para mostrar en el panel. */
export function originLabel(u: { signupSource: string | null; signupCampaign: string | null }) {
  if (!u.signupSource) return "Directo / sin dato"
  return u.signupCampaign ? `${u.signupSource} · ${u.signupCampaign}` : u.signupSource
}
