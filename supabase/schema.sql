-- Esquema de identidad y permisos para MantiJudicial en Supabase (Postgres).
-- Ejecutar en el SQL editor de Supabase cuando se conecte la web a la base de datos.
-- Hoy la identidad vive en data/identity.json; este esquema es el destino final
-- (RLS como defensa adicional, según docs/04_PERMISSIONS.md).

create extension if not exists "pgcrypto";

create table if not exists org (
  id text primary key default ('org_' || gen_random_bytes(8)::text),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists app_user (
  id text primary key default ('usr_' || gen_random_bytes(8)::text),
  email text not null unique,
  name text not null,
  password_hash text not null,
  mfa_secret text,
  mfa_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

-- Relación multi-organización: usuario -> membresía -> organización
create table if not exists firm_membership (
  user_id text not null references app_user(id) on delete cascade,
  org_id text not null references org(id) on delete cascade,
  role text not null check (role in ('ORG_ADMIN','LAWYER','PARALEGAL','VIEWER','PLATFORM_ADMIN')),
  primary key (user_id, org_id)
);

create table if not exists app_session (
  token text primary key,
  user_id text not null references app_user(id) on delete cascade,
  org_id text not null references org(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists case_file (
  id text primary key,                -- case_000034
  org_id text not null references org(id),
  headline text,
  branch text,
  outcome text,
  review_status text not null default 'UNREVIEWED',
  created_at timestamptz not null default now()
);

create table if not exists share_grant (
  id text primary key default ('grt_' || gen_random_bytes(8)::text),
  resource_id text not null,
  grantee_user_id text references app_user(id),
  grantee_org_id text references org(id),
  actions text[] not null,
  granted_by text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  check (grantee_user_id is not null or grantee_org_id is not null)
);

-- Notas privadas del abogado (LAWYER_ONLY): solo su autor
create table if not exists lawyer_note (
  id text primary key default ('not_' || gen_random_bytes(8)::text),
  case_id text not null references case_file(id) on delete cascade,
  user_id text not null references app_user(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  resource text not null,
  details jsonb not null default '{}'::jsonb
);

-- Auditoría inmutable
create or replace function deny_audit_mutation() returns trigger as $$
begin raise exception 'audit_log es de solo inserción'; end;
$$ language plpgsql;

drop trigger if exists audit_no_mutate on audit_log;
create trigger audit_no_mutate before update or delete on audit_log
  for each row execute function deny_audit_mutation();

-- ---------------------------------------------------------------------------
-- RLS: defensa adicional. La app pasa app.current_org_id y app.current_user_id.
-- ---------------------------------------------------------------------------
alter table org enable row level security;
alter table app_user enable row level security;
alter table firm_membership enable row level security;
alter table app_session enable row level security;
alter table case_file enable row level security;
alter table share_grant enable row level security;
alter table lawyer_note enable row level security;
alter table audit_log enable row level security;

-- El usuario solo ve su propia fila
create policy user_self on app_user
  for select using (id = current_setting('app.current_user_id', true));

create policy membership_own on firm_membership
  for select using (user_id = current_setting('app.current_user_id', true));

create policy session_own on app_session
  for select using (user_id = current_setting('app.current_user_id', true));

-- Casos: miembros de la organización
create policy case_member on case_file
  for select using (
    org_id = current_setting('app.current_org_id', true)
    and exists (
      select 1 from firm_membership m
      where m.user_id = current_setting('app.current_user_id', true)
        and m.org_id = case_file.org_id
    )
  );

-- Comparticiones: del recurso que se ve o dirigidas a mí
create policy grant_visible on share_grant
  for select using (
    grantee_user_id = current_setting('app.current_user_id', true)
    or grantee_org_id = current_setting('app.current_org_id', true)
  );

-- Notas: solo el autor
create policy note_author on lawyer_note
  for all using (user_id = current_setting('app.current_user_id', true))
  with check (user_id = current_setting('app.current_user_id', true));

-- Auditoría: solo lectura de lo propio
create policy audit_own on audit_log
  for select using (actor = current_setting('app.current_user_id', true));
