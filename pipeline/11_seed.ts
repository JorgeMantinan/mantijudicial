import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Role } from "./lib/authorization.js";
import { IdentityStore } from "./lib/identity.js";
import { REPO_ROOT } from "./lib/paths.js";

const IDENTITY_PATH = path.join(REPO_ROOT, "data", "identity.json");

interface Args {
  email: string;
  name: string;
  firm: string;
  password: string | null;
  force: boolean;
  resetEmail: string;
  resetPassword: string | null;
  add: { email: string; name: string; password: string; role: string; firm: string | null } | null;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    email: "admin@local.test",
    name: "Administrador",
    firm: "Despacho local",
    password: null,
    force: false,
    resetEmail: "admin@local.test",
    resetPassword: null,
    add: null,
  };
  let addEmail: string | null = null;
  let addName: string | null = null;
  let addPassword: string | null = null;
  let addRole: string | null = null;
  let addFirm: string | null = null;

  for (const arg of argv) {
    if (arg === "--force") args.force = true;
    const email = arg.match(/^--email=(.+)$/);
    const name = arg.match(/^--name=(.+)$/);
    const firm = arg.match(/^--firm=(.+)$/);
    const password = arg.match(/^--password=(.+)$/);
    const emailAdd = arg.match(/^--add-email=(.+)$/);
    const nameAdd = arg.match(/^--add-name=(.+)$/);
    const passwordAdd = arg.match(/^--add-password=(.+)$/);
    const roleAdd = arg.match(/^--add-role=(.+)$/);
    const firmAdd = arg.match(/^--add-firm=(.+)$/);
    const resetPwd = arg.match(/^--reset-password=(.+)$/);
    const resetMail = arg.match(/^--reset-email=(.+)$/);
    if (email?.[1]) args.email = email[1];
    if (name?.[1]) args.name = name[1];
    if (firm?.[1]) args.firm = firm[1];
    if (password?.[1]) args.password = password[1];
    if (resetPwd?.[1]) args.resetPassword = resetPwd[1];
    if (resetMail?.[1]) args.resetEmail = resetMail[1];
    if (emailAdd?.[1]) addEmail = emailAdd[1];
    if (nameAdd?.[1]) addName = nameAdd[1];
    if (passwordAdd?.[1]) addPassword = passwordAdd[1];
    if (roleAdd?.[1]) addRole = roleAdd[1];
    if (firmAdd?.[1]) addFirm = firmAdd[1];
  }

  if (addEmail) {
    args.add = {
      email: addEmail,
      name: addName ?? addEmail.split("@")[0] ?? "Usuario",
      password: addPassword ?? "cambiame-123",
      role: addRole ?? "LAWYER",
      firm: addFirm,
    };
  }
  if (!args.password) args.password = process.env.MJ_ADMIN_PASSWORD ?? null;
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.resetPassword) {
    const exists = await fs
      .stat(IDENTITY_PATH)
      .then(() => true)
      .catch(() => false);
    if (!exists) {
      process.stderr.write("No existe el almacén: ejecuta pnpm seed primero.\n");
      process.exitCode = 1;
      return;
    }
    try {
      const store = await IdentityStore.load(IDENTITY_PATH);
      const user = store.findUserByEmail(args.resetEmail);
      if (!user) {
        process.stderr.write(`No existe el usuario: ${args.resetEmail}\n`);
        process.exitCode = 1;
        return;
      }
      store.setPassword(user.id, args.resetPassword);
      const revoked = store.revokeSessionsOf(user.id);
      await store.save(IDENTITY_PATH);
      process.stdout.write("== CONTRASEÑA RESTABLECIDA ==\n");
      process.stdout.write(`${user.email}\n`);
      process.stdout.write(`Sesiones cerradas: ${revoked}\n`);
      process.stdout.write("Ya puedes entrar con la nueva contraseña.\n");
      return;
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
      return;
    }
  }

  if (args.add) {
    const exists = await fs
      .stat(IDENTITY_PATH)
      .then(() => true)
      .catch(() => false);
    if (!exists) {
      process.stderr.write("No existe el almacén: ejecuta pnpm seed primero.\n");
      process.exitCode = 1;
      return;
    }
    const store = await IdentityStore.load(IDENTITY_PATH);
    const targetFirm = args.add.firm
      ? (store.listFirms().find((item) => item.name === args.add?.firm) ??
        store.createFirm(args.add.firm))
      : store.listFirms()[0];
    if (!targetFirm) {
      process.stderr.write("No hay despachos en el almacén.\n");
      process.exitCode = 1;
      return;
    }
    const role = args.add.role as Role;
    if (!["ORG_ADMIN", "LAWYER", "PARALEGAL", "VIEWER"].includes(role)) {
      process.stderr.write(`Rol no válido: ${args.add.role}\n`);
      process.exitCode = 1;
      return;
    }
    const user = store.registerUser({
      email: args.add.email,
      name: args.add.name,
      password: args.add.password,
    });
    store.addMembership(user.id, targetFirm.id, role);
    await store.save(IDENTITY_PATH);
    process.stdout.write("== USUARIO AÑADIDO ==\n");
    process.stdout.write(`${user.email} · rol ${role} · despacho ${targetFirm.name}\n`);
    return;
  }

  const exists = await fs
    .stat(IDENTITY_PATH)
    .then(() => true)
    .catch(() => false);

  if (exists && !args.force) {
    const store = await IdentityStore.load(IDENTITY_PATH);
    process.stdout.write(`Ya existe ${IDENTITY_PATH}\n`);
    process.stdout.write(`Usuarios: ${store.listUsers().length} · Despachos: ${store.listFirms().length}\n`);
    process.stdout.write("Usa --force para regenerarlo (borra sesiones y usuarios existentes).\n");
    return;
  }

  const generated = args.password === null;
  const password = args.password ?? crypto.randomBytes(9).toString("base64url");

  const store = IdentityStore.empty();
  const firm = store.createFirm(args.firm);
  const user = store.registerUser({ email: args.email, name: args.name, password });
  store.addMembership(user.id, firm.id, "ORG_ADMIN");
  await store.save(IDENTITY_PATH);

  process.stdout.write("== IDENTIDAD INICIALIZADA ==\n");
  process.stdout.write(`Fichero: ${IDENTITY_PATH}\n`);
  process.stdout.write(`Despacho: ${firm.name} (${firm.id})\n`);
  process.stdout.write(`Usuario: ${user.email} · rol ORG_ADMIN\n`);
  if (generated) {
    process.stdout.write(`Contraseña generada: ${password}\n`);
    process.stdout.write("Guárdala: no vuelve a mostrarse. Cambia MJ_ADMIN_PASSWORD para fijarla.\n");
  }
  process.stdout.write("\nSiguiente: pnpm web → http://localhost:3000/login\n");
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
