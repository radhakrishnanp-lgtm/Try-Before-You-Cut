import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config";
import type { Consent, Member, Result, Salon, Style, TryOnSession } from "../types";
import type { Store, UsageStats } from "./types";

type Row = Record<string, unknown>;

let client: SupabaseClient | null = null;
export function adminClient(): SupabaseClient {
  client ??= createClient(config.supabaseUrl!, config.supabaseServiceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

const camel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function fromRow<T>(row: Row): T {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[camel(k)] = v;
  return out as T;
}
function toRow(obj: object): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[snake(k)] = v;
  return out;
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const one = async <T>(table: string, query: (q: ReturnType<SupabaseClient["from"]>) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T | null> => {
  const data = check(await query(adminClient().from(table))) as Row | null;
  return data ? fromRow<T>(data) : null;
};
const many = async <T>(table: string, query: (q: ReturnType<SupabaseClient["from"]>) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> => {
  const data = (check(await query(adminClient().from(table))) as Row[] | null) ?? [];
  return data.map((r) => fromRow<T>(r));
};

export const supabaseStore: Store = {
  getSalon: (id) => one<Salon>("salons", (q) => q.select().eq("id", id).maybeSingle()),
  getSalonBySlug: (slug) => one<Salon>("salons", (q) => q.select().eq("slug", slug).maybeSingle()),
  listSalons: () => many<Salon>("salons", (q) => q.select().order("name")),
  async createSalon(input) {
    return (await one<Salon>("salons", (q) => q.insert(toRow(input)).select().single()))!;
  },
  async updateSalon(id, patch) {
    return (await one<Salon>("salons", (q) => q.update(toRow(patch)).eq("id", id).select().single()))!;
  },
  async reserveCredits(salonId, count) {
    return Boolean(check(await adminClient().rpc("reserve_credits", { p_salon: salonId, p_count: count })));
  },
  async refundCredits(salonId, count) {
    check(await adminClient().rpc("refund_credits", { p_salon: salonId, p_count: count }));
  },

  listMembers: (salonId) => many<Member>("members", (q) => q.select().eq("salon_id", salonId).order("created_at")),
  membershipsForEmail: (email) => many<Member>("members", (q) => q.select().eq("email", email.toLowerCase())),
  async addMember(input) {
    return (await one<Member>("members", (q) =>
      q.upsert(toRow({ ...input, email: input.email.toLowerCase() }), { onConflict: "salon_id,email" }).select().single(),
    ))!;
  },
  async removeMember(salonId, memberId) {
    check(await adminClient().from("members").delete().eq("id", memberId).eq("salon_id", salonId));
  },

  async listStyles(opts = {}) {
    return many<Style>("styles", (q) => {
      let query = q.select();
      query = opts.salonId ? query.or(`salon_id.is.null,salon_id.eq.${opts.salonId}`) : query.is("salon_id", null);
      if (!opts.includeInactive) query = query.eq("active", true);
      return query.order("sort_order");
    });
  },
  getStyle: (id) => one<Style>("styles", (q) => q.select().eq("id", id).maybeSingle()),
  async upsertStyle(style) {
    return (await one<Style>("styles", (q) => q.upsert(toRow(style)).select().single()))!;
  },

  async createSession(input) {
    return (await one<TryOnSession>("sessions", (q) => q.insert(toRow(input)).select().single()))!;
  },
  getSession: (id) => one<TryOnSession>("sessions", (q) => q.select().eq("id", id).maybeSingle()),
  getSessionByShareToken: (token) => one<TryOnSession>("sessions", (q) => q.select().eq("share_token", token).maybeSingle()),
  async updateSession(id, patch) {
    return (await one<TryOnSession>("sessions", (q) => q.update(toRow(patch)).eq("id", id).select().single()))!;
  },
  listRecentSessions: (salonId, limit) =>
    many<TryOnSession>("sessions", (q) => q.select().eq("salon_id", salonId).order("created_at", { ascending: false }).limit(limit)),
  listExpiredSessions: (at, limit) =>
    many<TryOnSession>("sessions", (q) => q.select().is("deleted_at", null).lt("expires_at", at.toISOString()).limit(limit)),
  async createConsent(input) {
    return (await one<Consent>("consents", (q) => q.insert(toRow(input)).select().single()))!;
  },
  async withdrawConsent(sessionId) {
    check(await adminClient().from("consents").update({ withdrawn_at: new Date().toISOString() }).eq("session_id", sessionId).is("withdrawn_at", null));
  },

  createResults: (rows) => many<Result>("results", (q) => q.insert(rows.map(toRow)).select()),
  getResult: (id) => one<Result>("results", (q) => q.select().eq("id", id).maybeSingle()),
  listResults: (sessionId) => many<Result>("results", (q) => q.select().eq("session_id", sessionId).order("created_at")),
  async updateResult(id, patch) {
    return (await one<Result>("results", (q) => q.update(toRow(patch)).eq("id", id).select().single()))!;
  },
  async claimResult(id) {
    const rows = check(await adminClient().from("results").update({ status: "running" }).eq("id", id).eq("status", "pending").select("id"));
    return Array.isArray(rows) && rows.length === 1;
  },

  async addShareEvent(input) { check(await adminClient().from("share_events").insert(toRow(input))); },
  async logAccess(input) { check(await adminClient().from("access_logs").insert(toRow(input))); },
  async purgeAccessLogs(olderThan) {
    const rows = check(await adminClient().from("access_logs").delete().lt("created_at", olderThan.toISOString()).select("id"));
    return Array.isArray(rows) ? rows.length : 0;
  },
  async usage(salonId, since): Promise<UsageStats> {
    const c = adminClient();
    const iso = since.toISOString();
    const count = async (table: string, extra?: (q: any) => any) => {
      let q = c.from(table).select("id", { count: "exact", head: true }).eq("salon_id", salonId).gte("created_at", iso);
      if (extra) q = extra(q);
      const { count: n, error } = await q;
      if (error) throw new Error(error.message);
      return n ?? 0;
    };
    const [sessions, tryOns, failed, shares] = await Promise.all([
      count("sessions"),
      count("results", (q) => q.eq("status", "ready")),
      count("results", (q) => q.eq("status", "failed")),
      c.from("share_events").select("session_id").eq("salon_id", salonId).gte("created_at", iso).limit(10000),
    ]);
    const shareRows = (check(shares) as { session_id: string }[] | null) ?? [];
    return { sessions, tryOns, failed, sharedSessions: new Set(shareRows.map((r) => r.session_id)).size, shareEvents: shareRows.length };
  },
};
