import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { config, isDemo, isPlatformAdmin } from "./config";
import { safeEqual, sign } from "./crypto";
import { store } from "./store";
import type { Member } from "./types";

export const DEMO_COOKIE = "kk_demo_user";

export async function supabaseServer() {
  const jar = await cookies();
  return createServerClient(config.supabaseUrl!, config.supabaseAnonKey!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // Called from a Server Component; middleware refreshes the session.
        }
      },
    },
  });
}

export function demoCookieValue(email: string): string {
  return `${email}.${sign(`demo:${email}`)}`;
}

/** Email of the signed-in staff/owner/admin, or null. */
export async function currentEmail(): Promise<string | null> {
  if (isDemo) {
    const raw = (await cookies()).get(DEMO_COOKIE)?.value;
    if (!raw) return null;
    const i = raw.lastIndexOf(".");
    const email = raw.slice(0, i);
    return safeEqual(raw.slice(i + 1), sign(`demo:${email}`)) ? email : null;
  }
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user?.email?.toLowerCase() ?? null;
}

export interface StaffContext {
  email: string;
  memberships: Member[];
  isAdmin: boolean;
}

export async function staffContext(): Promise<StaffContext | null> {
  const email = await currentEmail();
  if (!email) return null;
  return { email, memberships: await store.membershipsForEmail(email), isAdmin: isPlatformAdmin(email) };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Membership for a salon; owners only when `ownerOnly`. Platform admins act as owners. */
export async function requireMember(salonId: string, opts: { ownerOnly?: boolean } = {}): Promise<{ ctx: StaffContext; member: Member | null }> {
  const ctx = await staffContext();
  if (!ctx) throw new HttpError(401, "Please sign in");
  const member = ctx.memberships.find((m) => m.salonId === salonId) ?? null;
  if (ctx.isAdmin) return { ctx, member };
  if (!member) throw new HttpError(403, "You are not a member of this salon");
  if (opts.ownerOnly && member.role !== "owner") throw new HttpError(403, "Only the salon owner can do this");
  return { ctx, member };
}

export async function requireAdmin(): Promise<StaffContext> {
  const ctx = await staffContext();
  if (!ctx) throw new HttpError(401, "Please sign in");
  if (!ctx.isAdmin) throw new HttpError(403, "Platform admins only");
  return ctx;
}
