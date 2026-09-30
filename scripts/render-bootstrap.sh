#!/usr/bin/env bash
# Puebla (y actualiza) el disco persistente de Render con el corpus.
# El corpus vive en la rama 'data' del repo (fuera de 'main' por ser datos).
# Se ejecuta en el build y en el arranque: es idempotente y barato
# (solo descarga si la rama remota cambió).
set -euo pipefail

ROOT="${MANTIJUDICIAL_ROOT:?Define MANTIJUDICIAL_ROOT con la ruta del disco}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

have_data() {
  [ -d "$1/cases" ] && [ -d "$1/laws" ] && [ -f "$1/data/identity.json" ]
}

remote_sha() { git ls-remote origin refs/heads/data 2>/dev/null | cut -f1 || true; }

SHA="$(remote_sha)"
STAMP="$ROOT/.data-branch"
LOCAL_SHA="$(cat "$STAMP" 2>/dev/null || echo "")"

if have_data "$ROOT" && [ -n "$LOCAL_SHA" ] && [ "$LOCAL_SHA" = "$SHA" ]; then
  echo "==> Corpus al día (rama $SHA)"
  exit 0
fi

if [ -z "$SHA" ]; then
  # Sin acceso a GitHub: no cortamos si ya hay datos.
  if have_data "$ROOT"; then
    echo "==> Aviso: no se pudo consultar la rama 'data'; uso los datos existentes"
    exit 0
  fi
  echo "ERROR: no hay corpus local ni acceso a la rama 'data'"
  exit 1
fi

if [ "$(cat .corpus/.sha 2>/dev/null || echo "")" != "$SHA" ]; then
  echo "==> Descargando corpus (rama data @ $SHA)"
  git fetch origin data --depth 1
  rm -rf .corpus
  mkdir -p .corpus
  git archive FETCH_HEAD cases laws data | tar -x -C .corpus
  echo "$SHA" > .corpus/.sha
fi

if mkdir -p "$ROOT" 2>/dev/null && touch "$ROOT/.escribible" 2>/dev/null; then
  rm -f "$ROOT/.escribible"
  echo "==> Copiando corpus al disco $ROOT"
  cp -a .corpus/. "$ROOT"/
  echo "$SHA" > "$STAMP"
  echo "==> Listo: $(ls "$ROOT" | tr '\n' ' ')"
else
  # El disco aún no está montado (pasa en la fase de build): se copiará al arrancar.
  echo "==> Aviso: $ROOT no es escribible todavía; se copiará en el arranque"
fi
