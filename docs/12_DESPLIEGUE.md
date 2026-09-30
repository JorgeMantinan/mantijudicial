# DESPLIEGUE — poner MantiJudicial fuera de tu equipo

Estado: **preparado para Render**. La web, los trabajos largos (ingesta, IA) y el
corpus viven en Render con disco persistente. Vercel no se usa (más abajo) y
Supabase queda pendiente hasta que tengas cupo: la identidad corre hoy en
`data/identity.json` sobre el disco.

## Dónde va cada cosa

| Pieza | Dónde | Por qué |
|---|---|---|
| Web + API + trabajos de IA | **Render** (Web Service, plan Starter con disco) | necesita disco, procesos vivos y subidas |
| Corpus `cases/` (26 MB) + `laws/` (59 MB) + `data/` | **rama `data`** del mismo repo privado → disco de Render | fuera de `main` por ser datos; `scripts/render-bootstrap.sh` los baja y los actualiza |
| Vercel | **no usar** | serverless: sin disco, ficheros de solo escritura y sin procesos largos |
| Supabase (identidad SQL + RLS) | pendiente (sin cupo) | hoy la identidad va en JSON sobre el disco, que funciona igual |

## Pasos en Render (proyecto "MantiJudicial")

1. https://dashboard.render.com → proyecto **MantiJudicial** → **New + → Blueprint**
   → conecta el repo **JorgeMantinan/mantijudicial** → Render detecta `render.yaml`
   de la raíz → **Apply**.
   (Si prefieres a mano: **New + → Web Service** → conecta el repo y usa los
   comandos y variables de abajo.)
2. Plan **Starter** (el disco persistente no existe en el gratuito).
3. El blueprint crea el servicio `mantijudicial`, disco de **5 GB** montado en
   `/var/data/mantijudicial` y health check en `/login`.
4. En **Environment** pega la clave de IA: `AI_API_KEY` → tipo **Secret**.
5. Espera al build (2-4 min). La primera vez baja el corpus desde la rama `data`.
6. Abre la URL (`https://mantijudicial-xxxx.onrender.com`) y entra con
   `admin@local.test` / `mantijudicial`.

Comprobación: `/cases` debe listar 80 casos y `/search?q=clausula suelo` dar hits.

## Variables de entorno — Render (Web Service)

| Variable | Valor | Origen |
|---|---|---|
| `NODE_VERSION` | `22` | en `render.yaml` |
| `NODE_ENV` | `production` | en `render.yaml` |
| `MANTIJUDICIAL_ROOT` | `/var/data/mantijudicial/repo` | en `render.yaml` |
| `AI_PROVIDER` | `http` | en `render.yaml` |
| `AI_API_KEY` | tu clave | **la pegas tú en el panel (Secret)** |
| `AI_BASE_URL` | `https://api.openai.com/v1` (o la de OpenRouter, DeepSeek…) | opcional |
| `AI_MODEL` | p. ej. `gpt-4o-mini`, `deepseek-chat`… | opcional |

Sin `AI_API_KEY`, la web funciona igual pero los trabajos de IA (ingesta,
reanálisis, comparaciones, vias, borrador de escrito) fallan con el aviso
"no hay clave de IA". Si prefieres el binario local de opencode en el servidor,
pon `AI_PROVIDER=opencode` e instálalo (`npm i -g opencode-ai` + `OPENCODE_BIN`).

Render rellena `PORT` solo; Next.js lo respeta.

## Variables de entorno — Vercel

**Ninguna: no despliegues esta app en Vercel.**

- El error "no es Next.js" viene de que el proyecto es un monorepo: el Next.js
  está en `apps/web`, no en la raíz. Se arregla en **Settings → General →
  Root Directory = `apps/web`** (y el preset Next.js ya es el correcto).
- Aun así no sirve: en Vercel no hay disco persistente (no leería `cases/` ni
  `laws/`, que además no están en `main`), el sistema de ficheros es de solo
  escritura (no se guardarían sesiones ni subidas) y los trabajos largos
  (ingesta, enriquecimiento, comparaciones) se cortan al llegar al timeout.
- Recomendación: borra el proyecto de Vercel y deja la web entera en Render.

## Variables de entorno — Supabase

**Todavía ninguna.** Mientras no tengas cupo, la identidad (usuarios, permisos,
sesiones, MFA) vive en `data/identity.json` + `data/grants.json` sobre el disco
de Render, que es el mismo mecanismo que en local. Cuando crees el proyecto:

1. Ejecuta `supabase/schema.sql` en el SQL editor.
2. Pon `DATABASE_URL` en Render (tipo Secret).
3. Sustituye la capa `IdentityStore` (JSON) por una capa SQL con las mismas
   operaciones (`registerUser`, `authenticate`, `createSession`, `actorFor`…).
   El servicio de autorización (`lib/authorization.ts`) **no cambia**.

## Actualizar los datos en el servidor

Cuando ingieras más sentencias o cambie algo en local:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/push-data.ps1
```

Sube `cases/`, `laws/`, `data/identity.json` y `data/grants.json` a la rama
`data`. Render los recoge en el siguiente deploy o reinicio (el arranque compara
el sha de la rama remota con el disco: si coinciden, no descarga nada).

## Opción B — VPS (contenedor propio)

Mismo esquema, con más control: Docker + volumen para `cases/`, `laws/` y `data/`.
Cualquier máquina Linux con Node 20+ sirve; el pipeline es solo Node.

## Checklist antes de darlo a un cliente

- [ ] Repo **privado** (ya lo es): la rama `data` contiene el corpus y los hashes
      de contraseñas. No la hagas pública nunca.
- [ ] `data/` fuera de `main` (ya) y sin `sessions` en la rama `data` (ya).
- [ ] HTTPS obligatorio (Render lo termina) y cookie de sesión `secure` en
      producción (ya).
- [ ] MFA activado para los usuarios con acceso (`/users` → Doble factor).
- [ ] Copia de seguridad de `cases/`, `laws/` y `data/` (disco de Render + local).
- [ ] Revisión de RGPD: el texto de las sentencias de clientes se envía al modelo
      de IA — tener contrato/base legítima con el proveedor (ver
      `docs/11_PROBLEMAS_Y_LIMITES.md`).
- [ ] Aviso en la UI: análisis asistido por IA pendiente de validación profesional.
- [ ] Los textos del BOE se citan como *meramente informativos* (ya está en la UI).

## Qué NO hacer

- No subir `main` con `data/`, `cases/` ni `laws/`.
- No exponer la web sin autenticación: el `proxy` ya exige sesión en todas las rutas.
- No meter sentencias de clientes en un repo público.
