# Restaura una copia creada con scripts\backup.ps1.
#
#   powershell -ExecutionPolicy Bypass -File scripts\restore.ps1              # última copia
#   powershell -ExecutionPolicy Bypass -File scripts\restore.ps1 -Zip ruta.zip
#
# Antes de restaurar hace una copia de seguridad de lo que hay ahora.
param([string]$Zip = "")

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "backups"

if (-not $Zip) {
  $ultima = Get-ChildItem $out -Filter "mantijudicial-*.zip" -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending | Select-Object -First 1
  if (-not $ultima) { throw "No hay copias en backups/ (ejecuta antes scripts\backup.ps1)" }
  $Zip = $ultima.FullName
}
if (-not (Test-Path $Zip)) { throw "No existe el zip: $Zip" }

Write-Output ("Restaurando: " + (Split-Path $Zip -Leaf))
Write-Output "Copia de seguridad de lo actual antes de restaurar…"
& (Join-Path $PSScriptRoot "backup.ps1") -Keep 100

Expand-Archive -Path $Zip -DestinationPath $root -Force

$casos = @(Get-ChildItem (Join-Path $root "cases") -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match "^case_\d{6}$" }).Count
$leyes = @(Get-ChildItem (Join-Path $root "laws\norms") -File -ErrorAction SilentlyContinue).Count
$identidad = Test-Path (Join-Path $root "data\identity.json")

Write-Output ""
Write-Output "Verificación:"
Write-Output ("  casos:    $casos")
Write-Output ("  normas:   $leyes")
Write-Output ("  identidad (data/identity.json): " + $(if ($identidad) { "OK" } else { "FALTA" }))

if ($casos -gt 0 -and $leyes -gt 0 -and $identidad) {
  Write-Output ""
  Write-Output "Restauración correcta. Arranca con: pnpm web"
} else {
  Write-Output ""
  Write-Output "AVISO: la verificación no cuadra; revisa el zip."
  exit 1
}
