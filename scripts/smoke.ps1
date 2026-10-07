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

$nodosPrevios = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  ForEach-Object { [int]$_.ProcessId })

$proc = Start-Process -FilePath "pnpm.cmd" -ArgumentList "exec","next","start","-p","$Port" `
  -WorkingDirectory (Join-Path $root "apps\web") -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 7

# Procesos de este script: el árbol descendiente de $proc más los node.exe que
# no existían antes de arrancar (todos del servidor que acabamos de lanzar).
function Get-PidsPropios {
  $propios = New-Object "System.Collections.Generic.HashSet[int]"
  [void]$propios.Add([int]$proc.Id)
  $cola = New-Object "System.Collections.Generic.Queue[int]"
  $cola.Enqueue([int]$proc.Id)
  while ($cola.Count -gt 0) {
    $padre = $cola.Dequeue()
    $hijos = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$padre" -ErrorAction SilentlyContinue)
    foreach ($hijo in $hijos) {
      if ($propios.Add([int]$hijo.ProcessId)) { $cola.Enqueue([int]$hijo.ProcessId) }
    }
  }
  foreach ($n in @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue)) {
    if ($nodosPrevios -contains [int]$n.ProcessId) { continue }
    # Solo si además es de ESTA prueba (puerto o directorio de la web); los
    # node.exe de otros programas que arranquen mientras tanto se ignoran.
    $cmd = $n.CommandLine
    if ($cmd -and (($cmd -like "*$Port*") -or ($cmd -like "*apps\web*"))) {
      [void]$propios.Add([int]$n.ProcessId)
    }
  }
  return $propios
}
$pidsPropios = Get-PidsPropios

$jarA = Join-Path $env:TEMP "smoke-admin.txt"
$jarC = Join-Path $env:TEMP "smoke-carlos.txt"
$html = Join-Path $env:TEMP "smoke.html"
$csv = Join-Path $env:TEMP "smoke.csv"
Remove-Item $jarA, $jarC, $html, $csv -ErrorAction SilentlyContinue

try {
  $login = curl.exe -s -c $jarA -X POST "$base/api/auth/login" -H "Content-Type: application/json" `
    -d '{\"email\":\"admin@local.test\",\"password\":\"mantijudicial\"}'
  Check "login admin" ($login -match '"ok":true')

  # NB: los textos esperados son los del corpus actual (p. ej.
  # "falta por concretar" es el literal de case_000034): si cambia el corpus
  # hay que actualizarlos a mano.
  $rutas = [ordered]@{
    "/"                                             = "Accesos directos"
    "/cases"                                        = "descargar CSV"
    "/review"                                       = "Aplicar a"
    "/alertas"                                      = "en total"
    "/informes"                                     = "Informe del periodo"
    "/plazos"                                       = "Plazos procesales"
    "/evolucion"                                    = "Evoluci"
    "/search?q=clausula"                            = "documentos indexados"
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
  # NB: el umbral 81 (= 80 casos del corpus + cabecera) es del corpus actual,
  # no un número universal: sube si entran casos y baja si se archivan.
  Check ("csv casos (" + ($filas.Count - 1) + " filas)") ($filas.Count -ge 81)

  curl.exe -s -b $jarA "$base/api/export/informe?desde=2026-01-01&hasta=2026-12-31" -o $csv
  $filas = (Get-Content $csv -Encoding UTF8)
  Check ("csv informe (" + ($filas.Count - 1) + " filas)") ($filas.Count -gt 1)

  $login2 = curl.exe -s -c $jarC -X POST "$base/api/auth/login" -H "Content-Type: application/json" `
    -d '{\"email\":\"carlos@local.test\",\"password\":\"carlos-12345\"}'
  Check "login carlos" ($login2 -match '"ok":true')

  foreach ($ruta in @("/evolucion", "/patterns", "/alertas", "/review", "/informes?desde=2026-01-01&hasta=2026-12-31")) {
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
  # Solo se matan los procesos arrancados por ESTE script (sus PIDs): nunca se
  # toca el resto de node.exe de la máquina.
  $finales = Get-PidsPropios
  foreach ($id in @($pidsPropios) + @($finales)) {
    if ($null -ne $id) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
  }
  Remove-Item $jarA, $jarC, $html, $csv -ErrorAction SilentlyContinue
}

Write-Output ""
$mensaje = "TODO OK"
if ($failures -gt 0) { $mensaje = "$failures fallos" }
Write-Output ("Resultado: " + $mensaje)
if ($failures -gt 0) { exit 1 }
