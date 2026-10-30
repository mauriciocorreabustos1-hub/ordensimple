// OrdenSimple para PC: abre www.ordensimple.cl en su propia ventana y le da lo que el navegador no puede:
// imprimir sin la ventana de impresión en la impresora que se elija (como página o con comandos ESC/POS de
// impresora térmica, que cortan el papel) y mandar tickets a impresoras de red por su IP.
// La web sabe que está aquí por "OrdenSimpleDesktop" en el user agent y usa window.OrdenSimpleDesktop.

const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require("electron")
const path = require("node:path")
const fs = require("node:fs")
const os = require("node:os")
const net = require("node:net")
const dns = require("node:dns/promises")
const { execFile } = require("node:child_process")
const { autoUpdater } = require("electron-updater")

// Para probar contra un servidor local: ORDENSIMPLE_URL=http://localhost:3000
const START = process.env.ORDENSIMPLE_URL || "https://www.ordensimple.cl"
const ALLOWED = new Set([new URL(START).origin, "https://www.ordensimple.cl", "https://ordensimple.cl"])
const isOurs = (url) => {
  try {
    return ALLOWED.has(new URL(url).origin)
  } catch {
    return false
  }
}

let win = null

// Una sola ventana: si se abre otra vez, se muestra la que ya estaba.
if (!app.requestSingleInstanceLock()) app.quit()
app.on("second-instance", () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
})

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    minHeight: 560,
    title: "OrdenSimple",
    icon: path.join(__dirname, "build", "icon.png"),
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.webContents.setUserAgent(`${win.webContents.getUserAgent()} OrdenSimpleDesktop/${app.getVersion()}`)

  // Lo que no es OrdenSimple (WhatsApp, Mercado Pago, enlaces externos) se abre en el navegador de siempre.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isOurs(url)) return { action: "allow" }
    if (/^(https?|mailto|tel|whatsapp):/i.test(url)) void shell.openExternal(url)
    return { action: "deny" }
  })
  win.webContents.on("will-navigate", (event, url) => {
    if (isOurs(url) || url.startsWith("file:")) return
    event.preventDefault()
    if (/^(https?|mailto|tel|whatsapp|intent):/i.test(url)) void shell.openExternal(url)
  })

  // Sin internet: una página propia con "Volver a intentar".
  win.webContents.on("did-fail-load", (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return
    void win.loadFile(path.join(__dirname, "offline.html"), { query: { url: url || START } })
  })

  void win.loadURL(`${START}/dashboard`)
}

// Menú mínimo (Windows): recargar, zoom y herramientas para soporte.
Menu.setApplicationMenu(
  Menu.buildFromTemplate([
    {
      label: "OrdenSimple",
      submenu: [
        { role: "reload", label: "Recargar" },
        { role: "togglefullscreen", label: "Pantalla completa" },
        { type: "separator" },
        { role: "zoomIn", label: "Agrandar" },
        { role: "zoomOut", label: "Achicar" },
        { role: "resetZoom", label: "Tamaño normal" },
        { type: "separator" },
        { role: "toggleDevTools", label: "Herramientas de soporte" },
        { role: "quit", label: "Salir" },
      ],
    },
  ]),
)

/* ---------- Impresión (solo para las páginas de OrdenSimple) ---------- */

/** Solo una impresora que esté de verdad instalada en Windows (y nunca algo que parezca un parámetro). */
async function checkPrinter(deviceName) {
  if (typeof deviceName !== "string" || !deviceName || deviceName.startsWith("-")) throw new Error("BAD_PRINTER")
  const list = await win.webContents.getPrintersAsync()
  if (!list.some((p) => p.name === deviceName)) throw new Error("BAD_PRINTER")
  return deviceName
}

// Impresoras de red: solo los puertos de impresión directa y nunca este mismo PC (ni direcciones especiales).
const PRINTER_PORTS = new Set([9100, 9101, 9102])
const BLOCKED = new net.BlockList()
BLOCKED.addSubnet("0.0.0.0", 8, "ipv4")
BLOCKED.addSubnet("127.0.0.0", 8, "ipv4")
BLOCKED.addSubnet("169.254.0.0", 16, "ipv4")
BLOCKED.addSubnet("224.0.0.0", 3, "ipv4") // multicast y reservadas
BLOCKED.addSubnet("::", 128, "ipv6")
BLOCKED.addSubnet("::1", 128, "ipv6")
BLOCKED.addSubnet("fe80::", 10, "ipv6")
BLOCKED.addSubnet("ff00::", 8, "ipv6")

function isBlocked(address) {
  // "::ffff:127.0.0.1" es una IPv4 escrita como IPv6: se revisa como IPv4.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)
  if (mapped) return BLOCKED.check(mapped[1], "ipv4")
  return BLOCKED.check(address, net.isIPv6(address) ? "ipv6" : "ipv4")
}

/** La IP real a la que se conecta (ya revisada): así no la cambia un nombre que se resuelva distinto después. */
async function checkNetworkTarget(host, port) {
  if (typeof host !== "string" || !/^[\w.:-]{1,100}$/.test(host)) throw new Error("BAD_INPUT")
  const n = Number(port) || 9100
  if (!PRINTER_PORTS.has(n)) throw new Error("BAD_PORT")
  const addresses = await dns.lookup(host, { all: true, verbatim: true })
  if (!addresses.length) throw new Error("BAD_HOST")
  // Para probar con ORDENSIMPLE_URL apuntando a un servidor local se permite este PC.
  if (!process.env.ORDENSIMPLE_URL && addresses.some((a) => isBlocked(a.address))) throw new Error("BAD_HOST")
  return { host: addresses[0].address, port: n }
}

function guard(handler) {
  return async (event, ...args) => {
    if (!isOurs(event.senderFrame?.url ?? "")) throw new Error("NOT_ALLOWED")
    return handler(...args)
  }
}

ipcMain.handle(
  "printers:list",
  guard(async () => {
    const list = await win.webContents.getPrintersAsync()
    return list.map((p) => ({ name: p.name, displayName: p.displayName || p.name, isDefault: Boolean(p.isDefault) }))
  }),
)

// Una página (HTML del ticket) a la impresora elegida, sin ventana de impresión.
ipcMain.handle(
  "printers:html",
  guard(async (html, deviceName) => {
    if (typeof html !== "string" || html.length > 2_000_000) throw new Error("BAD_INPUT")
    const printer = await checkPrinter(deviceName)
    return new Promise((resolve, reject) => {
      const page = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true } })
      page.webContents.once("did-finish-load", () => {
        page.webContents.print({ silent: true, deviceName: printer, printBackground: false, margins: { marginType: "none" } }, (ok, reason) => {
          page.destroy()
          if (ok) resolve(true)
          else reject(new Error(reason || "PRINT_FAILED"))
        })
      })
      void page.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    })
  }),
)

// Bytes ESC/POS directo a una impresora de Windows (cola de impresión en modo RAW): corta el papel y usa letra grande.
ipcMain.handle(
  "printers:raw",
  guard(async (deviceName, base64) => {
    if (process.platform !== "win32") throw new Error("ONLY_WINDOWS")
    if (typeof base64 !== "string" || base64.length > 4_000_000) throw new Error("BAD_INPUT")
    await checkPrinter(deviceName)
    const file = path.join(os.tmpdir(), `ordensimple-${process.pid}-${Date.now()}.bin`)
    fs.writeFileSync(file, Buffer.from(base64, "base64"))
    const script = app.isPackaged ? path.join(process.resourcesPath, "app.asar.unpacked", "raw-print.ps1") : path.join(__dirname, "raw-print.ps1")
    try {
      await new Promise((resolve, reject) => {
        execFile(
          "powershell.exe",
          ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, "-Printer", deviceName, "-File", file],
          { windowsHide: true, timeout: 30_000 },
          (error, _stdout, stderr) => (error ? reject(new Error(String(stderr || error.message).trim().slice(0, 300))) : resolve()),
        )
      })
    } finally {
      fs.rm(file, { force: true }, () => {})
    }
    return true
  }),
)

// Bytes a una impresora de red (puerto 9100), como la app del celular.
ipcMain.handle(
  "printers:tcp",
  guard(async (host, port, base64) => {
    if (typeof base64 !== "string" || base64.length > 4_000_000) throw new Error("BAD_INPUT")
    const target = await checkNetworkTarget(host, port)
    return new Promise((resolve, reject) => {
        const socket = net.connect(target)
        socket.setTimeout(8000, () => {
          socket.destroy()
          reject(new Error("TIMEOUT"))
        })
        socket.on("error", (e) => reject(e))
        socket.on("connect", () => socket.end(Buffer.from(base64, "base64"), () => resolve(true)))
    })
  }),
)

/* ---------- Arranque y actualizaciones ---------- */

app.whenReady().then(() => {
  createWindow()
  if (app.isPackaged) {
    autoUpdater.autoDownload = true
    autoUpdater.on("update-downloaded", async (info) => {
      const { response } = await dialog.showMessageBox(win, {
        type: "info",
        buttons: ["Reiniciar ahora", "Más tarde"],
        defaultId: 0,
        title: "OrdenSimple",
        message: `Hay una versión nueva de OrdenSimple (${info.version}).`,
        detail: "Se instala al reiniciar la app. Si eliges más tarde, se instala la próxima vez que la abras.",
      })
      if (response === 0) autoUpdater.quitAndInstall()
    })
    autoUpdater.checkForUpdates().catch(() => {})
  }
})

app.on("window-all-closed", () => app.quit())
