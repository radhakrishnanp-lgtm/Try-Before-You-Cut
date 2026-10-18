import { cookies } from "next/headers";
import { config, isDemo } from "./config";
import { safeEqual, sha256, sign } from "./crypto";
import { hashPasswordSync, verifyPassword } from "./password";
import { store } from "./store";
import type { Member } from "./types";

/**
 * Username + password logins with a signed, httpOnly session cookie.
 * Salon owners and stylists are rows in `members`; the platform admin (you)
 * comes from ADMIN_USERNAME / ADMIN_PASSWORD(_HASH). Changing a password
 * invalidates existing sessions because the cookie carries a hash stamp.
 */
export const SESSION_COOKIE = "tbyc_session";
const SESSION_DAYS = 14;

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const stampOf = (passwordHash: string) => sha256(passwordHash).slice(0, 16);

let demoAdminHash: string | null = null;
/** The admin's password hash, or null when admin login is disabled. */
function adminHash(): string | null {
  if (config.adminPasswordHash) return config.adminPasswordHash;
  if (config.adminPassword) return (demoAdminHash ??= hashPasswordSync(config.adminPassword));
  if (isDemo) return (demoAdminHash ??= hashPasswordSync("admin1234"));
  return null;
}
export const DEMO_ADMIN_PASSWORD = "admin1234";

function encode(kind: "a" | "m", id: string, stamp: string): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  const payload = Buffer.from(`${kind}:${id}:${exp}:${stamp}`).toString("base64url");
  return `${payload}.${sign(`session:${payload}`)}`;
}

function decode(value: string | undefined): { kind: "a" | "m"; id: string; stamp: string } | null {
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig || !safeEqual(sign(`session:${payload}`), sig)) return null;
  const [kind, id, exp, stamp] = Buffer.from(payload, "base64url").toString().split(":");
  if ((kind !== "a" && kind !== "m") || !id || Number(exp) < Date.now() / 1000) return null;
  return { kind, id, stamp };
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.appUrl.startsWith("https://"),
  path: "/",
  maxAge: SESSION_DAYS * 86400,
};

/** Check credentials; returns the cookie value to set, or null. */
export async function login(username: string, password: string): Promise<{ cookie: string; isAdmin: boolean } | null> {
  const name = username.trim().toLowerCase();
  if (name === config.adminUsername) {
    const hash = adminHash();
    if (hash && (await verifyPassword(password, hash))) return { cookie: encode("a", "admin", stampOf(hash)), isAdmin: true };
    return null;
  }
  const auth = await store.getMemberAuth({ username: name });
  // Verify against a dummy hash when the user is unknown so timing doesn't reveal it.
  const ok = await verifyPassword(password, auth?.passwordHash ?? DUMMY_HASH);
  if (!auth || !ok) return null;
  return { cookie: encode("m", auth.member.id, stampOf(auth.passwordHash)), isAdmin: false };
}
const DUMMY_HASH = hashPasswordSync("not-a-real-password");

export interface StaffContext {
  isAdmin: boolean;
  /** The signed-in salon member (null for the platform admin). */
  member: Member | null;
  displayName: string;
}

export async function staffContext(): Promise<StaffContext | null> {
  const s = decode((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) return null;
  if (s.kind === "a") {
    const hash = adminHash();
    return hash && safeEqual(stampOf(hash), s.stamp) ? { isAdmin: true, member: null, displayName: "Platform admin" } : null;
  }
  const auth = await store.getMemberAuth({ id: s.id });
  if (!auth || !safeEqual(stampOf(auth.passwordHash), s.stamp)) return null;
  const salon = await store.getSalon(auth.member.salonId);
  if (!salon?.active) return null;
  return { isAdmin: false, member: auth.member, displayName: auth.member.name ?? auth.member.username };
}

/** Member of the salon (owners only when `ownerOnly`). The platform admin acts as owner of any salon. */
export async function requireMember(salonId: string, opts: { ownerOnly?: boolean } = {}): Promise<{ ctx: StaffContext; member: Member | null }> {
  const ctx = await staffContext();
  if (!ctx) throw new HttpError(401, "Please sign in");
  if (ctx.isAdmin) return { ctx, member: null };
  if (ctx.member?.salonId !== salonId) throw new HttpError(403, "You are not a member of this salon");
  if (opts.ownerOnly && ctx.member.role !== "owner") throw new HttpError(403, "Only the salon owner can do this");
  return { ctx, member: ctx.member };
}

export async function requireAdmin(): Promise<StaffContext> {
  const ctx = await staffContext();
  if (!ctx) throw new HttpError(401, "Please sign in");
  if (!ctx.isAdmin) throw new HttpError(403, "Platform admins only");
  return ctx;
}

export function adminLoginEnabled(): boolean {
  return adminHash() !== null;
}
