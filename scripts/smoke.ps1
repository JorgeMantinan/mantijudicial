# Regresión manual automatizada: arranca la web, comprueba rutas con admin y
# aislamiento con carlos (Despacho_B) y devuelve código de salida != 0 si algo
# falla. No usa IA de pago.
#
#   powershell -ExecutionPolicy Bypass -File scripts\smoke.ps1
param([int]$Port = 3290)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$base = "http://localhost:$Port"
$failures = 0

function Check([string]$name, [bool]$ok) {
  if ($ok) {
    Write-Output ("  PASS " + $name)
  } else {
    Write-Output ("  FAIL " + $name)
    $script:failures = $script:failures + 1
  }
}

$proc = Start-Process -FilePath "pnpm.cmd" -ArgumentList "exec","next","start","-p","$Port" `
  -WorkingDirectory (Join-Path $root "apps\web") -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 7

$jarA = Join-Path $env:TEMP "smoke-admin.txt"
$jarC = Join-Path $env:TEMP "smoke-carlos.txt"
$html = Join-Path $env:TEMP "smoke.html"
$csv = Join-Path $env:TEMP "smoke.csv"
Remove-Item $jarA, $jarC, $html, $csv -ErrorAction SilentlyContinue

try {
  $login = curl.exe -s -c $jarA -X POST "$base/api/auth/login" -H "Content-Type: application/json" `
    -d '{\"email\":\"admin@local.test\",\"password\":\"mantijudicial\"}'
  Check "login admin" ($login -match '"ok":true')

  $rutas = [ordered]@{
    "/"                                             = "Accesos directos"
    "/cases"                                        = "descargar CSV"
    "/review"                                       = "Aplicar a"
    "/alertas"                                      = "en total"
    "/informes"                                     = "Informe del periodo"
    "/plazos"                                       = "Plazos procesales"
    "/evolucion"                                    = "Evoluci"
    "/search?q=clausula"                            = "resultados de"
    "/laws"                                         = "BOE"
    "/laws/BOE-A-2000-323"                          = "bloques"
    "/patterns"                                     = "criterio dividido"
    "/eval"                                         = "Coste en vivo"
    "/ayuda"                                        = "Atajos de teclado"
    "/users"                                        = "Actividad reciente"
    "/temas/costas"                                 = "argumentos"
    "/temas/comparar?a=costas&b=congruencia"        = "Comparar dos temas"
    "/cases/case_000034"                            = "falta por concretar"
    "/cases/case_000034/print"                      = "Resumen"
    "/cases/case_000034/dossier"                    = "Dossier del asunto"
    "/cases/case_000034/compare/case_000037"        = "Informe comparativo"
  }
  foreach ($ruta in $rutas.Keys) {
    curl.exe -s -b $jarA ($base + $ruta) -o $html
    $t = Get-Content $html -Raw -Encoding UTF8
    Check ("admin " + $ruta) ($t -match [regex]::Escape($rutas[$ruta]))
  }

  curl.exe -s -b $jarA "$base/api/export/casos" -o $csv
  $filas = (Get-Content $csv -Encoding UTF8)
  Check ("csv casos (" + ($filas.Count - 1) + " filas)") ($filas.Count -ge 81)

  curl.exe -s -b $jarA "$base/api/export/informe?desde=2026-01-01&hasta=2026-12-31" -o $csv
  $filas = (Get-Content $csv -Encoding UTF8)
  Check ("csv informe (" + ($filas.Count - 1) + " filas)") ($filas.Count -gt 1)

  $login2 = curl.exe -s -c $jarC -X POST "$base/api/auth/login" -H "Content-Type: application/json" `
    -d '{\"email\":\"carlos@local.test\",\"password\":\"carlos-12345\"}'
  Check "login carlos" ($login2 -match '"ok":true')

  foreach ($ruta in @("/evolucion", "/patterns", "/alertas", "/informes?desde=2026-01-01&hasta=2026-12-31")) {
    curl.exe -s -b $jarC ($base + $ruta) -o $html
    $t = Get-Content $html -Raw -Encoding UTF8
    $ids = [regex]::Matches($t, 'href="/cases/(case_\d{6})"')
    Check ("carlos sin casos ajenos en " + $ruta) ($ids.Count -eq 0)
  }

  $codigo = curl.exe -s -b $jarC -o $html -w "%{http_code}" "$base/cases/case_000034"
  Check "carlos no abre ficha ajena (307)" ($codigo -eq "307")

  $codigo = curl.exe -s -b $jarC -o $html -w "%{http_code}" "$base/users"
  Check "carlos no entra en /users (307)" ($codigo -eq "307")

  $codigo = curl.exe -s -o $html -w "%{http_code}" "$base/cases"
  Check "sin sesión → login (307)" ($codigo -eq "307")
} finally {
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Remove-Item $jarA, $jarC, $html, $csv -ErrorAction SilentlyContinue
}

Write-Output ""
$mensaje = "TODO OK"
if ($failures -gt 0) { $mensaje = "$failures fallos" }
Write-Output ("Resultado: " + $mensaje)
if ($failures -gt 0) { exit 1 }
