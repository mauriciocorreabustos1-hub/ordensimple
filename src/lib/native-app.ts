// La app de OrdenSimple para iPhone y Android (Capacitor, en la carpeta mobile/) abre www.ordensimple.cl y agrega
// "OrdenSimpleApp" al user agent. Así la web sabe cuándo está dentro de la app.

export const APP_USER_AGENT = "OrdenSimpleApp"
/** La app de PC (Electron, carpeta desktop/) agrega este otro. */
export const DESKTOP_USER_AGENT = "OrdenSimpleDesktop"

export type DesktopBridge = {
  listPrinters: () => Promise<{ name: string; displayName: string; isDefault: boolean }[]>
  printHtml: (html: string, deviceName: string) => Promise<boolean>
  printRaw: (deviceName: string, base64: string) => Promise<boolean>
  sendTcp: (host: string, port: number, base64: string) => Promise<boolean>
}

/** El puente de la app de PC, si la página está abierta ahí. */
export function desktopBridge() {
  return typeof window === "undefined" ? undefined : (window as Window & { OrdenSimpleDesktop?: DesktopBridge }).OrdenSimpleDesktop
}

type CapacitorGlobal = { isNativePlatform?: () => boolean; Plugins?: Record<string, unknown> }

function capacitor() {
  return typeof window === "undefined" ? undefined : (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor
}

/** Dentro de la app (en el navegador del celular o del computador, no). */
export function isNativeApp() {
  return Boolean(capacitor()?.isNativePlatform?.())
}

/** Un plugin nativo de la app, si está. */
export function nativePlugin<T>(name: string): T | undefined {
  return isNativeApp() ? (capacitor()?.Plugins?.[name] as T | undefined) : undefined
}

/**
 * La visita viene de la app para iPhone (se lee en el servidor). En el iPhone los planes no se contratan dentro de la
 * app: Apple exige su propio sistema de pago para eso.
 */
export function isIosAppUserAgent(userAgent: string | null | undefined) {
  // El iPad se presenta como "Macintosh": basta con que no sea la app de Android.
  return Boolean(userAgent?.includes(APP_USER_AGENT) && !/Android/i.test(userAgent))
}
