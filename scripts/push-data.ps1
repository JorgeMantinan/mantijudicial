# Sube los datos (cases/ laws/ data/identity.json data/grants.json) a la rama
# 'data' del repositorio, que es la que usa Render para poblar su disco.
# No toca la rama main ni modifica tu working tree.
#
#   powershell -ExecutionPolicy Bypass -File scripts/push-data.ps1
#
# Después, Render recoge los cambios en el próximo deploy (o reinicio) del servicio.
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$gitDir = (git rev-parse --git-dir).Trim()
if (-not [System.IO.Path]::IsPathRooted($gitDir)) { $gitDir = (Resolve-Path $gitDir).Path }
$idx = Join-Path $gitDir "data-index"
$identityTmp = Join-Path $gitDir "identity-sin-sesiones.json"

# La identidad viaja sin sesiones (cada instancia genera las suyas).
$identity = Get-Content (Join-Path $repo "data\identity.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$identity.sessions = @()
$identity | ConvertTo-Json -Depth 20 | Set-Content $identityTmp -Encoding UTF8

$env:GIT_INDEX_FILE = $idx
try {
  git read-tree --empty
  if ($LASTEXITCODE -ne 0) { throw "read-tree falló" }

  git add -f cases laws data/grants.json
  if ($LASTEXITCODE -ne 0) { throw "git add falló" }

  $sha = (git hash-object -w $identityTmp).Trim()
  git update-index --add --cacheinfo "100644,$sha,data/identity.json"
  if ($LASTEXITCODE -ne 0) { throw "update-index falló" }

  $tree = (git write-tree).Trim()
  $commit = (git commit-tree $tree -m "datos actualizados $(Get-Date -Format 'yyyy-MM-dd HH:mm')")
  if ($LASTEXITCODE -ne 0) { throw "commit-tree falló" }

  git update-ref refs/heads/data $commit
  if ($LASTEXITCODE -ne 0) { throw "update-ref falló" }
} finally {
  Remove-Item Env:GIT_INDEX_FILE -ErrorAction SilentlyContinue
  Remove-Item $idx, $identityTmp -ErrorAction SilentlyContinue
}

Write-Output "commit de datos: $commit ($((git ls-tree -r data --name-only | Measure-Object -Line).Lines) ficheros)"
# La rama 'data' se genera entera cada vez (es un volcado de datos), por eso
# se fuerza el push: solo este script la escribe.
git push --force origin data:refs/heads/data
if ($LASTEXITCODE -ne 0) { throw "push falló" }
Write-Output "Rama 'data' actualizada en GitHub."
