// Puente entre la página de OrdenSimple y la app de PC: solo estas funciones, nada más de Node.
const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("OrdenSimpleDesktop", {
  /** Impresoras instaladas en Windows. */
  listPrinters: () => ipcRenderer.invoke("printers:list"),
  /** Página (HTML del ticket) a la impresora elegida, sin ventana de impresión. */
  printHtml: (html, deviceName) => ipcRenderer.invoke("printers:html", html, deviceName),
  /** Bytes ESC/POS (en base64) directo a una impresora de Windows. */
  printRaw: (deviceName, base64) => ipcRenderer.invoke("printers:raw", deviceName, base64),
  /** Bytes ESC/POS (en base64) a una impresora de red por su IP. */
  sendTcp: (host, port, base64) => ipcRenderer.invoke("printers:tcp", host, port, base64),
})
