# Publica el instalador de OrdenSimple para PC en GitHub Releases (repositorio público ordensimple-escritorio,
# que solo guarda los instaladores; el código sigue privado). De ahí lo bajan ordensimple.cl/descargar y las
# actualizaciones automáticas de la app.
# Uso (desde la carpeta desktop, después de "npm run dist" con la versión nueva en package.json):
#   powershell -ExecutionPolicy Bypass -File .\publicar-version.ps1
$ErrorActionPreference = "Stop"
$gh = "C:\Program Files\GitHub CLI\gh.exe"
$repo = "mauriciocorreabustos1-hub/ordensimple-escritorio"
$version = (Get-Content (Join-Path $PSScriptRoot "package.json") -Raw | ConvertFrom-Json).version
$dist = Join-Path $PSScriptRoot "dist"

& $gh repo view $repo *> $null
if ($LASTEXITCODE -ne 0) {
  & $gh repo create $repo --public --add-readme --description "Instaladores de OrdenSimple para PC (Windows). Descarga en https://www.ordensimple.cl/descargar"
}

& $gh release create "v$version" `
  (Join-Path $dist "OrdenSimple-Setup.exe") `
  (Join-Path $dist "OrdenSimple-Setup.exe.blockmap") `
  (Join-Path $dist "latest.yml") `
  --repo $repo --title "OrdenSimple para PC $version" --notes "Descarga OrdenSimple-Setup.exe e instálalo. Más información en https://www.ordensimple.cl/descargar" --latest
Write-Host "Publicada la versión $version en https://github.com/$repo/releases/tag/v$version"
