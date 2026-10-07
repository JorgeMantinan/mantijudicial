# AGENTS.md

Guía de trabajo para este repositorio (humanos y agentes IA). Si algo de aquí
cambia, actualiza este archivo.

## Qué es

MantiJudicial: pipeline TypeScript (`pipeline/`) que analiza sentencias del TS
(`cases/`, fuera de git) y legislación del BOE (`laws/`, fuera de git), más una
web Next.js 16 (`apps/web/`) para despachos de abogados. Todo el texto de UI en
**castellano**.

Documentación de diseño: `docs/00_README.md` (índice), `docs/12_DESPLIEGUE.md`
(despliegue), `docs/11_PROBLEMAS_Y_LIMITES.md`.

## Comandos (desde la raíz)

```bash
pnpm typecheck                # tsc --noEmit (solo pipeline/; para la web:
                              #   pnpm --dir apps/web exec tsc --noEmit)
pnpm test                     # vitest: pipeline/lib/*.test.ts + apps/web/lib/*.test.ts
pnpm exec next build          # build de producción (o pnpm --dir apps/web build)
pnpm web                      # next dev en :3000
pnpm web:build / web:start
```

CI: `.github/workflows/ci.yml` (push y PR a `main`) con pnpm 11 + Node 20:
`pnpm typecheck`, `tsc --noEmit` de `apps/web` y `pnpm test`. **Sin `next
build`**: el build necesita el corpus (`cases/`), que no está en `main`.
Para que esa comprobación funcione, `pnpm-workspace.yaml` declara
`packages: ["apps/*"]` (si no, `pnpm install` en la raíz no instala la web).

Pipeline (CLI, `tsx`): `pnpm hygiene|extract|metadata|enrich|laws|match|
patterns|search|vias|ingest|seed|eval|supplement|compare|escrito`.
Casos concretos: `pnpm eval -- --show`, `pnpm compare -- --a=case_000034`,
`pnpm escrito -- --a=case_000034 --tipo=RECURSO_CASACION`.
`pnpm audit:failed` lista casos con extracción fallida.

### Verificación obligatoria tras cualquier cambio

1. `pnpm typecheck` — **solo cubre `pipeline/`** (el tsconfig de la raíz no
   incluye `apps/web`).
2. `pnpm test`
3. `pnpm exec next build` — compila la web **y** hace su typecheck: es la
   comprobación real de `apps/web` (o `pnpm --dir apps/web exec tsc --noEmit`
   si solo quieres el typecheck).
4. Si hay UI nueva: arrancar el server y comprobarlo (ver "Pruebas manuales").

## Datos y ramas

- `main` **solo código**. `cases/`, `laws/` y `data/` están en `.gitignore`.
- Los datos viven en la **rama `data`** del mismo repo (privado). Subirlos:
  `powershell -ExecutionPolicy Bypass -File scripts/push-data.ps1`
  (push con `--force`: solo ese script la escribe).
- `MANTIJUDICIAL_ROOT` cambia la raíz del corpus (la usan `apps/web/lib/dataset.ts`
  y `pipeline/lib/paths.ts`; en Render apunta al disco). Local: no hace falta.
- En local no se versionan `data/identity.json` (usuarios+hashes+MFA) ni
  sesiones: nunca subirlos a `main`.

## Convenciones de código

- **Etiquetas**: nunca texto literal en la UI; usa `apps/web/lib/labels.ts` y
  `label(MAP, valor)` (fallback: valor en mayúsculas). Añade la clave nueva ahí.
- **Auth**: toda página/ruta empieza con `requireActor()` (+ `defaultOrgId()`,
  `authorizationGrants()`, `canViewCase(...)`) o `getActor()` en APIs. Permiso
  **deny-by-default** en `pipeline/lib/authorization.ts`. Los agregados que
  muestran casos (`/informes`, `/alertas`, `/temas`, `/review`, `/evolucion`,
  portada) deben filtrar con `canViewCase`: en dataset hay funciones que
  aceptan un predicado `permitido(caseId)` (`getInforme`, `getTema`).
- **Tablas ordenables**: `apps/web/lib/sort-th.tsx`.
- **Trabajos largos**: `JobRegistry` (`pipeline/lib/jobs.ts`, singleton en
  `apps/web/lib/jobs.ts`), serializados con `runExclusive`; las APIs
  (`/api/ingest|reanalyze|compare`) lanzan los CLI con `tsx`.
- **Imprimibles** (PDF del navegador): `article.print-sheet` +
  `<PrintButton />` (`apps/web/components/print-button.tsx`) + clases
  `no-print`. Ver `/cases/[id]/print`, `/cases/[id]/dossier`,
  `/cases/[id]/compare/[other]`, `/alertas`, `/temas/[topic]`.
- **IA**: `createAIProvider()` en `pipeline/lib/ai_provider.ts` → HTTP si hay
  `AI_API_KEY` (compatible OpenAI), si no `opencode`. Salidas en
  `cases/<id>/structured/*.json` con `analysis` (modelo, coste, prompt_version).
  Costes orientativos: enriquecer caso ≈ $0,012; comparar ≈ $0,003;
  borrador de escrito ≈ $0,002.
- **Datos en la web**: `apps/web/lib/dataset.ts` (casos, leyes, búsqueda,
  evolución) + `apps/web/lib/dataset-estado.ts` (informes, alertas, costes,
  calidad, sistema, búsquedas guardadas), re-exportado con `export *` para que
  todo siga importándose desde `@/lib/dataset`.
- **Tests**: `pipeline/lib/<modulo>.test.ts` con vitest (`describe/it/expect`),
  datos de prueba inline en español.

## Pruebas manuales (server de comprobación)

```powershell
pnpm exec next start -p 3230   # desde apps/web (o pnpm --dir apps/web start)
curl -s -c jar.txt -X POST http://localhost:3230/api/auth/login -H "Content-Type: application/json" -d '{\"email\":\"admin@local.test\",\"password\":\"mantijudicial\"}'
curl -s -b jar.txt http://localhost:3230/ruta
```

Credenciales demo: `admin@local.test`/`mantijudicial` (ORG_ADMIN),
`ana@local.test`/`ana-12345` y `carlos@local.test`/`carlos-12345` (LAWYER;
carlos está en **Despacho_B**, sirve para probar el aislamiento).

## Trampas conocidas (Windows / PowerShell 5.1)

- **Rutas con corchetes** (`app/cases/[id]/…`): usar `-LiteralPath` con
  `Select-String`/`Get-Content`; con `-Path` los `[ ]` se interpretan comodín.
- No usar `$home` (variable de solo lectura); `$env:TEMP` sí.
- Scripts `node -e` o PowerShell largos: escribirlos a un fichero en
  `C:\Users\Jorge\AppData\Local\Temp\opencode\` y ejecutarlos (el inline falla
  por escaping).
- `Set-Content -Encoding UTF8` en PS 5.1 añade **BOM**: eliminarlo después
  ([System.Text.UTF8Encoding]$false).
- **Nunca `Add-Content`/`Set-Content` sin codificación** en `.ts`/`.tsx`: escribe
  en ANSI y rompe el fichero UTF-8 (el build falla con "invalid utf-8" aunque
  `tsc` pase). Para escribir: herramienta Edit, o
  `[System.IO.File]::WriteAllText($ruta, $texto, [System.Text.UTF8Encoding]$false)`.
- Los avisos `LF will be replaced by CRLF` de git son normales (autocrlf).
- `rg` (ripgrep) **no está instalado**: usar la herramienta Grep.
- `bash` no está en PATH: `C:\Program Files\Git\bin\bash.exe`.

## Pendientes / decisiones abiertas

- **Subir casos sin gastar**: `pnpm ingest -- --file=X.pdf --skip-enrich` (CLI,
  solo extracción/reglas, 0 €) y enriquecer después con
  `pnpm enrich -- --cases=case_XXXXXX` cuando él lo autorice. Por la web la
  subida SIEMPRE enriquece (≈ 0,012 $/caso).
- Supabase (identidad SQL + RLS): sin cupo; hoy identidad en
  `data/identity.json` sobre el disco. `supabase/schema.sql` ya está listo.
- Despliegue en Render preparado (`render.yaml`, bootstrap en
  `scripts/render-bootstrap.sh`); **no desplegado**. Vercel: no usar.
- Embeddings/búsqueda semántica: bloqueados (el proveedor no los da).
