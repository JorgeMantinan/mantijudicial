# Copia de seguridad de cases/, laws/ y data/ en backups/ (fuera de git).
#
#   powershell -ExecutionPolicy Bypass -File scripts\backup.ps1 [-Keep 5]
#
# Restaurar: descomprime el zip sobre la raíz del repo (sobrescribe).
param([int]$Keep = 5)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "backups"
New-Item -ItemType Directory -Force -Path $out | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zip = Join-Path $out "mantijudicial-$stamp.zip"

$targets = @("cases", "laws", "data") |
  Where-Object { Test-Path (Join-Path $root $_) } |
  ForEach-Object { Join-Path $root $_ }

if ($targets.Count -eq 0) { throw "No hay ni cases, laws ni data que copiar" }

$incluidos = ($targets | ForEach-Object { Split-Path $_ -Leaf }) -join ", "
Write-Output "Copiando: $incluidos"
Compress-Archive -Path $targets -DestinationPath $zip -Force

$size = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Output ("Copia creada: " + (Split-Path $zip -Leaf) + " ($size MB)")

$viejas = Get-ChildItem $out -Filter "mantijudicial-*.zip" |
  Sort-Object Name -Descending |
  Select-Object -Skip $Keep
foreach ($f in $viejas) {
  Remove-Item $f.FullName -Force
  Write-Output ("Borrada (retención $Keep): " + $f.Name)
}

$actuales = (Get-ChildItem $out -Filter "mantijudicial-*.zip").Count
Write-Output ("Copias en disco: $actuales")
