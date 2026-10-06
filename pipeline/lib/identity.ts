import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Actor, Role } from "./authorization.js";
import { generateSecret, otpauthUri, totp, verifyTotp } from "./totp";

const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };
const KEYLEN = 64;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
  /** TOTP pendiente de confirmar (solo si mfa_enabled es true está activo). */
  mfa_secret?: string | null;
  mfa_enabled?: boolean;
  /** Último contador TOTP consumido en el login (no se reutiliza un código). */
  mfa_last_counter?: number;
}

export interface Firm {
  id: string;
  name: string;
  created_at: string;
}

export interface Membership {
  userId: string;
  firmId: string;
  role: Role;
}

export interface Session {
  token: string;
  userId: string;
  firmId: string;
  created_at: string;
  expires_at: string;
}

interface StoreData {
  version: number;
  users: User[];
  firms: Firm[];
  memberships: Membership[];
  sessions: Session[];
}

export class IdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdentityError";
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, KEYLEN, SCRYPT_OPTIONS).toString("hex");
  return `scrypt$${SCRYPT_OPTIONS.N}$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const [, n, salt, hash] = parts;
  if (!n || !salt || !hash) return false;
  const rounds = Number(n);
  if (!Number.isInteger(rounds) || rounds < 1024 || rounds > 1 << 20) return false;
  const derived = crypto.scryptSync(password, salt, KEYLEN, {
    ...SCRYPT_OPTIONS,
    N: rounds,
  });
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== derived.length) return false;
  return crypto.timingSafeEqual(expected, derived);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export class IdentityStore {
  private data: StoreData;

  private constructor(data: StoreData) {
    this.data = data;
  }

  static empty(): IdentityStore {
    return new IdentityStore({ version: 1, users: [], firms: [], memberships: [], sessions: [] });
  }

  static async load(filePath: string): Promise<IdentityStore> {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as StoreData;
      if (!Array.isArray(parsed.users)) throw new Error("estructura no válida");
      return new IdentityStore(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return IdentityStore.empty();
      throw error;
    }
  }

  toJSON(): StoreData {
    return {
      version: this.data.version,
      users: this.data.users,
      firms: this.data.firms,
      memberships: this.data.memberships,
      sessions: this.data.sessions,
    };
  }

  async save(filePath: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(this.toJSON(), null, 2)}\n`, "utf8");
    await fs.rename(tmp, filePath);
  }

  listUsers(): User[] {
    return [...this.data.users];
  }

  listFirms(): Firm[] {
    return [...this.data.firms];
  }

  listMemberships(userId?: string): Membership[] {
    return this.data.memberships.filter((item) => !userId || item.userId === userId);
  }

  findUserByEmail(email: string): User | null {
    const normalized = normalizeEmail(email);
    return this.data.users.find((user) => user.email === normalized) ?? null;
  }

  registerUser(input: { email: string; name: string; password: string }): User {
    const email = normalizeEmail(input.email);
    if (!isValidEmail(email)) throw new IdentityError("Correo no válido");
    if (input.name.trim().length === 0) throw new IdentityError("El nombre es obligatorio");
    if (input.password.length < 8) throw new IdentityError("La contraseña necesita 8 caracteres mínimo");
    if (this.findUserByEmail(email)) throw new IdentityError("Ese correo ya está registrado");
    const user: User = {
      id: `usr_${crypto.randomBytes(8).toString("hex")}`,
      email,
      name: input.name.trim(),
      password_hash: hashPassword(input.password),
      created_at: new Date().toISOString(),
    };
    this.data.users.push(user);
    return user;
  }

  authenticate(email: string, password: string): User | null {
    const user = this.findUserByEmail(email);
    if (!user) {
      verifyPassword(password, hashPassword("decoy-password"));
      return null;
    }
    return verifyPassword(password, user.password_hash) ? user : null;
  }

  createFirm(name: string): Firm {
    const trimmed = name.trim();
    if (trimmed.length === 0) throw new IdentityError("El nombre del despacho es obligatorio");
    const firm: Firm = {
      id: `firm_${crypto.randomBytes(6).toString("hex")}`,
      name: trimmed,
      created_at: new Date().toISOString(),
    };
    this.data.firms.push(firm);
    return firm;
  }

  addMembership(userId: string, firmId: string, role: Role): Membership {
    const existing = this.data.memberships.find(
      (item) => item.userId === userId && item.firmId === firmId,
    );
    if (existing) {
      existing.role = role;
      return existing;
    }
    const membership: Membership = { userId, firmId, role };
    this.data.memberships.push(membership);
    return membership;
  }

  membershipOf(userId: string, firmId: string): Membership | null {
    return (
      this.data.memberships.find((item) => item.userId === userId && item.firmId === firmId) ?? null
    );
  }

  createSession(userId: string, firmId: string, now = new Date()): Session {
    const session: Session = {
      token: crypto.randomBytes(32).toString("hex"),
      userId,
      firmId,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    };
    this.data.sessions.push(session);
    return session;
  }

  getSession(token: string, now = new Date()): Session | null {
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const session = this.data.sessions.find((item) => item.token === token);
    if (!session) return null;
    if (Date.parse(session.expires_at) <= now.getTime()) {
      this.revokeSession(token);
      return null;
    }
    return session;
  }

  revokeSession(token: string): void {
    this.data.sessions = this.data.sessions.filter((item) => item.token !== token);
  }

  /** Al cambiar una contraseña se invalidan todas las sesiones abiertas. */
  revokeSessionsOf(userId: string): number {
    const before = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((item) => item.userId !== userId);
    return before - this.data.sessions.length;
  }

  setPassword(userId: string, password: string): void {
    const user = this.data.users.find((item) => item.id === userId);
    if (!user) throw new IdentityError("Usuario no encontrado");
    if (password.length < 8) throw new IdentityError("La contraseña necesita 8 caracteres mínimo");
    user.password_hash = hashPassword(password);
  }

  /** Genera y guarda el secreto TOTP; queda inactivo hasta confirmarlo con un código. */
  setupMfa(userId: string): { secret: string; uri: string } {
    const user = this.data.users.find((item) => item.id === userId);
    if (!user) throw new IdentityError("Usuario no encontrado");
    const secret = generateSecret();
    user.mfa_secret = secret;
    user.mfa_enabled = false;
    return { secret, uri: otpauthUri(secret, user.email) };
  }

  confirmMfa(userId: string, code: string): boolean {
    const user = this.data.users.find((item) => item.id === userId);
    if (!user?.mfa_secret) throw new IdentityError("Primero hay que generar el código");
    if (!verifyTotp(user.mfa_secret, code)) return false;
    user.mfa_enabled = true;
    return true;
  }

  disableMfa(userId: string, code: string): boolean {
    const user = this.data.users.find((item) => item.id === userId);
    if (!user?.mfa_secret) return false;
    if (!verifyTotp(user.mfa_secret, code)) return false;
    user.mfa_secret = null;
    user.mfa_enabled = false;
    this.revokeSessionsOf(userId);
    return true;
  }

  mfaEnabled(userId: string): boolean {
    return this.data.users.find((item) => item.id === userId)?.mfa_enabled === true;
  }

  /** true si el código TOTP es válido para este usuario (o no tiene MFA).
   * El contador del código se consume: el mismo código no sirve dos veces
   * (replay dentro de su ventana de ±1 paso). */
  checkMfa(userId: string, code: string | undefined): boolean {
    const user = this.data.users.find((item) => item.id === userId);
    if (!user) return false;
    if (!user.mfa_enabled) return true;
    if (!user.mfa_secret) return false;
    if (!code) return false;
    const paso = 30_000;
    const ahora = Date.now();
    const actual = Math.floor(ahora / paso);
    for (let offset = -1; offset <= 1; offset += 1) {
      const contador = actual + offset;
      if (contador <= (user.mfa_last_counter ?? -1)) continue;
      if (totp(user.mfa_secret, contador * paso + Math.floor(paso / 2)) === code) {
        user.mfa_last_counter = contador;
        return true;
      }
    }
    return false;
  }

  pruneSessions(now = new Date()): number {
    const before = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter(
      (item) => Date.parse(item.expires_at) > now.getTime(),
    );
    return before - this.data.sessions.length;
  }

  actorFor(session: Session): Actor | null {
    const membership = this.membershipOf(session.userId, session.firmId);
    if (!membership) return null;
    const orgIds = this.data.memberships
      .filter((item) => item.userId === session.userId)
      .map((item) => item.firmId);
    return {
      userId: session.userId,
      orgId: session.firmId,
      role: membership.role,
      orgIds: [...new Set(orgIds)],
    };
  }
}
