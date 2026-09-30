#!/usr/bin/env bash
# Puebla el disco persistente de Render con el corpus (cases/ + laws/ + data/).
# El corpus está en la rama 'data' del repo (fuera de 'main' por ser datos).
# Se ejecuta tanto en el build como en el arranque: es idempotente.
set -euo pipefail

ROOT="${MANTIJUDICIAL_ROOT:?Define MANTIJUDICIAL_ROOT con la ruta del disco}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

have_data() {
  [ -d "$1/cases" ] && [ -d "$1/laws" ] && [ -f "$1/data/identity.json" ]
}

if have_data "$ROOT"; then
  echo "==> Corpus ya presente en $ROOT"
  exit 0
fi

if ! have_data "./.corpus"; then
  echo "==> Descargando corpus (rama 'data')"
  git fetch origin data --depth 1
  mkdir -p .corpus
  git archive FETCH_HEAD cases laws data | tar -x -C .corpus
fi

if mkdir -p "$ROOT" 2>/dev/null && touch "$ROOT/.escribible" 2>/dev/null; then
  rm -f "$ROOT/.escribible"
  echo "==> Copiando corpus al disco $ROOT"
  cp -a .corpus/. "$ROOT"/
  echo "==> Listo: $(ls "$ROOT" | tr '\n' ' ')"
else
  # El disco aún no está montado (pasa en la fase de build): se copiará al arrancar.
  echo "==> Aviso: $ROOT no es escribible todavía; se copiará en el arranque"
fi
