// Copia el motor del lector de códigos (WebAssembly) a public/wasm, con la versión en el nombre.
// Así se sirve desde el propio sitio (sin depender de un servidor externo) y se puede guardar en caché para siempre.
import fs from "node:fs"

const dirs = ["node_modules/barcode-detector/node_modules/zxing-wasm", "node_modules/zxing-wasm"]
const dir = dirs.find((d) => fs.existsSync(`${d}/package.json`))
if (!dir) {
  console.warn("No se encontró zxing-wasm: el lector de códigos en iPhone no tendrá su motor.")
} else {
  const { version } = JSON.parse(fs.readFileSync(`${dir}/package.json`, "utf8"))
  fs.mkdirSync("public/wasm", { recursive: true })
  for (const f of fs.readdirSync("public/wasm")) if (f.startsWith("zxing_reader-")) fs.rmSync(`public/wasm/${f}`)
  fs.copyFileSync(`${dir}/dist/reader/zxing_reader.wasm`, `public/wasm/zxing_reader-${version}.wasm`)
}
