import { db } from "../db/pool";
import type { Consent, Member, Result, Salon, Style, TryOnSession } from "../types";
import { DuplicateError, type MemberAuth, type Store, type UsageStats } from "./types";

type Row = Record<string, unknown>;

const camel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function fromRow<T>(row: Row): T {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[camel(k)] = v;
  return out as T;
}

const JSON_COLS = new Set(["art", "provider_state"]);

async function q<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const pool = await db();
  try {
    return (await pool.query(sql, params)).rows as T[];
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw new DuplicateError((err as Error).message);
    throw err;
  }
}
const one = async <T>(sql: string, params: unknown[] = []) => {
  const rows = await q<Row>(sql, params);
  return rows[0] ? fromRow<T>(rows[0]) : null;
};
const many = async <T>(sql: string, params: unknown[] = []) => (await q<Row>(sql, params)).map((r) => fromRow<T>(r));

/** Build "insert into t (cols) values ($1..) returning *" from a camelCase object. */
function insert(table: string, obj: object): [string, unknown[]] {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
  const cols = entries.map(([k]) => snake(k));
  const vals = entries.map(([k, v]) => (JSON_COLS.has(snake(k)) && v !== null ? JSON.stringify(v) : v));
  return [`insert into ${table} (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning *`, vals];
}

function update(table: string, id: string, patch: object, extraWhere = ""): [string, unknown[]] {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return [`select * from ${table} where id = $1`, [id]];
  const sets = entries.map(([k], i) => `${snake(k)} = $${i + 2}`);
  const vals = entries.map(([k, v]) => (JSON_COLS.has(snake(k)) && v !== null ? JSON.stringify(v) : v));
  return [`update ${table} set ${sets.join(", ")} where id = $1 ${extraWhere} returning *`, [id, ...vals]];
}

function memberOf(row: Row): Member {
  const { passwordHash: _p, ...m } = fromRow<Member & { passwordHash?: string }>(row);
  return m;
}

export const postgresStore: Store = {
  getSalon: (id) => one<Salon>("select * from salons where id = $1", [id]),
  getSalonBySlug: (slug) => one<Salon>("select * from salons where slug = $1", [slug]),
  listSalons: () => many<Salon>("select * from salons order by name"),
  async createSalon(input) {
    return (await one<Salon>(...insert("salons", input)))!;
  },
  async updateSalon(id, patch) {
    const s = await one<Salon>(...update("salons", id, patch));
    if (!s) throw new Error("salon not found");
    return s;
  },
  async reserveCredits(salonId, credits) {
    const rows = await q(
      "update salons set credits_used = credits_used + $2 where id = $1 and active and credits_used + $2 <= credits_total returning id",
      [salonId, credits],
    );
    return rows.length === 1;
  },
  async refundCredits(salonId, credits) {
    await q("update salons set credits_used = greatest(0, credits_used - $2) where id = $1", [salonId, credits]);
  },
  async adjustCredits(salonId, delta) {
    const s = await one<Salon>("update salons set credits_total = greatest(0, credits_total + $2) where id = $1 returning *", [salonId, delta]);
    if (!s) throw new Error("salon not found");
    return s;
  },

  async listMembers(salonId) {
    return (await q<Row>("select * from members where salon_id = $1 order by created_at", [salonId])).map(memberOf);
  },
  async getMemberAuth(by): Promise<MemberAuth | null> {
    const rows = "id" in by
      ? await q<Row>("select * from members where id = $1", [by.id])
      : await q<Row>("select * from members where username = $1", [by.username.toLowerCase()]);
    if (!rows[0]) return null;
    return { member: memberOf(rows[0]), passwordHash: String(rows[0].password_hash) };
  },
  async addMember(input) {
    const rows = await q<Row>(...insert("members", { ...input, username: input.username.toLowerCase() }));
    return memberOf(rows[0]);
  },
  async setMemberPassword(memberId, passwordHash) {
    await q("update members set password_hash = $2 where id = $1", [memberId, passwordHash]);
  },
  async removeMember(salonId, memberId) {
    await q("delete from members where id = $1 and salon_id = $2", [memberId, salonId]);
  },

  listStyles: (opts = {}) =>
    many<Style>(
      `select * from styles where (salon_id is null ${opts.salonId ? "or salon_id = $1" : ""}) ${opts.includeInactive ? "" : "and active"} order by sort_order`,
      opts.salonId ? [opts.salonId] : [],
    ),
  getStyle: (id) => one<Style>("select * from styles where id = $1", [id]),
  async upsertStyle(style) {
    const [sql, vals] = insert("styles", style);
    const cols = Object.keys(style).filter((k) => k !== "id" && (style as unknown as Row)[k] !== undefined).map(snake);
    return (await one<Style>(sql.replace(" returning *", ` on conflict (id) do update set ${cols.map((c) => `${c} = excluded.${c}`).join(", ")} returning *`), vals))!;
  },

  async createSession(input) {
    return (await one<TryOnSession>(...insert("sessions", input)))!;
  },
  getSession: (id) => one<TryOnSession>("select * from sessions where id = $1", [id]),
  getSessionByShareToken: (token) => one<TryOnSession>("select * from sessions where share_token = $1", [token]),
  async updateSession(id, patch) {
    const s = await one<TryOnSession>(...update("sessions", id, patch));
    if (!s) throw new Error("session not found");
    return s;
  },
  listRecentSessions: (salonId, limit) => many<TryOnSession>("select * from sessions where salon_id = $1 order by created_at desc limit $2", [salonId, limit]),
  listExpiredSessions: (at, limit) =>
    many<TryOnSession>("select * from sessions where deleted_at is null and expires_at < $1 limit $2", [at.toISOString(), limit]),
  listPendingRemoteCleanup: (limit) =>
    many<TryOnSession>("select * from sessions where deleted_at is not null and provider_state is not null limit $1", [limit]),
  async createConsent(input) {
    return (await one<Consent>(...insert("consents", input)))!;
  },
  async withdrawConsent(sessionId) {
    await q("update consents set withdrawn_at = now() where session_id = $1 and withdrawn_at is null", [sessionId]);
  },

  async createResults(rows) {
    const out: Result[] = [];
    for (const r of rows) out.push((await one<Result>(...insert("results", r)))!);
    return out;
  },
  getResult: (id) => one<Result>("select * from results where id = $1", [id]),
  listResults: (sessionId) => many<Result>("select * from results where session_id = $1 order by created_at, id", [sessionId]),
  async updateResult(id, patch) {
    const r = await one<Result>(...update("results", id, patch));
    if (!r) throw new Error("result not found");
    return r;
  },
  async claimResult(id) {
    return (await q("update results set status = 'running' where id = $1 and status = 'pending' returning id", [id])).length === 1;
  },

  async addShareEvent(input) {
    await q(...insert("share_events", input));
  },
  async logAccess(input) {
    await q("insert into access_logs (salon_id, session_id, actor, action) values ($1, $2, $3, $4)", [input.salonId, input.sessionId, input.actor, input.action]);
  },
  async purgeAccessLogs(olderThan) {
    return (await q("delete from access_logs where created_at < $1 returning id", [olderThan.toISOString()])).length;
  },
  async usage(salonId, since): Promise<UsageStats> {
    const [row] = await q<Record<string, string>>(
      `select
         (select count(*) from sessions where salon_id = $1 and created_at >= $2) as sessions,
         (select count(*) from results where salon_id = $1 and created_at >= $2 and status = 'ready') as try_ons,
         (select count(*) from results where salon_id = $1 and created_at >= $2 and status = 'failed') as failed,
         (select count(distinct session_id) from share_events where salon_id = $1 and created_at >= $2) as shared_sessions,
         (select count(*) from share_events where salon_id = $1 and created_at >= $2) as share_events`,
      [salonId, since.toISOString()],
    );
    return {
      sessions: Number(row.sessions), tryOns: Number(row.try_ons), failed: Number(row.failed),
      sharedSessions: Number(row.shared_sessions), shareEvents: Number(row.share_events),
    };
  },
};
