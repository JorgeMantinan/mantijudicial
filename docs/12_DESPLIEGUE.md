# DESPLIEGUE — poner MantiJudicial fuera de tu equipo

Estado hoy: **todo local**. La web corre en tu máquina (`pnpm web`), lee `cases/` y
`laws/` de tu disco y lanza los procesos de IA con el binario de opencode. Nada está
en la nube y no hay servicios de pago.

## Por qué no se despliega con un clic

| Requisito | Situación |
|---|---|
| Corpus (`cases/`, 25 MB) | **Fuera de git** (datos). Hay que subirlo al servidor por separado |
| Legislación (`laws/`, 59 MB) | También fuera de git; se regenera con `pnpm laws` |
| Procesos largos (ingesta, enriquecimiento) | No funcionan en Vercel/serverless: necesitan disco y procesos vivos |
| IA (`opencode run`) | Hoy usa tu opencode local; en servidor hay que instalarlo y autenticarlo, o cambiar de proveedor (`lib/ai_provider.ts`) |
| Identidad | `data/identity.json` local → en servidor: Supabase (más abajo) |

## Opción A — Render (la más fácil con `render.yaml`)

1. Sube el repositorio a GitHub (hecho) y crea el servicio con el blueprint
   `render.yaml` de la raíz (https://render.com/blueprints).
2. El blueprint monta un **disco de 5 GB** en `/var/data/mantijudicial`.
3. Sube el corpus al disco (desde tu equipo):
   ```bash
   # comprime fuera de git y súbelo por SSH/SFTP de Render
   tar -czf corpus.tar.gz cases laws
   ```
4. Variables: `MANTIJUDICIAL_ROOT` apunta a la raíz del repo dentro del disco.
5. Arranque: `pnpm install && pnpm --dir apps/web build` (build) ·
   `pnpm --dir apps/web start` (start).
6. **IA en servidor**: instala `opencode` (`npm i -g opencode-ai`), autentícalo una
   vez y define `OPENCODE_BIN` si la ruta no es la por defecto. Alternativa:
   implementar otro `AIProvider` (OpenAI/Anthropic) con su API key.

## Opción B — VPS (contenedor propio)

Mismo esquema, con más control: Docker + volumen para `cases/`, `laws/` y `data/`.
Cualquier máquina Linux con Node 20+ sirve; el pipeline es solo Node.

## Supabase (identidad en Postgres con RLS)

Cuando vayas a dar acceso a gente fuera de tu equipo:

1. Crea el proyecto en https://supabase.com y ejecuta `supabase/schema.sql`
   en el SQL editor (tablas, RLS y auditoría inmutable).
2. Conecta `DATABASE_URL` (o el pooler) en las variables de entorno.
3. Sustituye la capa `IdentityStore` (hoy JSON) por una capa SQL con las mismas
   operaciones: `registerUser`, `authenticate`, `createSession`, `actorFor`…
   El servicio de autorización (`lib/authorization.ts`) **no cambia**: recibe un
   `Actor` y una lista de `Grant`, vengan de donde vengan.
4. Migración de datos: `data/identity.json` → tablas (script de un solo uso).
5. MFA: los secretos TOTP pasan a la columna `mfa_secret`.

## Checklist antes de darlo a un cliente

- [ ] Repo **privado** (ya lo es) y `data/` fuera de git (ya).
- [ ] HTTPS obligatorio y cookie de sesión `secure` en producción.
- [ ] MFA activado para los usuarios con acceso (`/users` → Doble factor).
- [ ] Copia de seguridad de `cases/`, `laws/` y `data/`.
- [ ] Revisión de RGPD: el texto de las sentencias de clientes se envía al modelo
      de IA — tener contrato/base legítima con el proveedor (ver `docs/11_PROBLEMAS_Y_LIMITES.md`).
- [ ] Aviso en la UI: análisis asistido por IA pendiente de validación profesional.
- [ ] Los textos del BOE se citan como *meramente informativos* (ya está en la UI).

## Qué NO hacer

- No subir `data/` (contraseñas con hash, concesiones, auditoría) a ningún repo.
- No exponer la web sin autenticación: el `proxy` ya exige sesión en todas las rutas.
- No meter sentencias de clientes en un repo público.
