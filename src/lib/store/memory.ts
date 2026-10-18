import { randomUUID } from "node:crypto";
import { CATALOGUE } from "../styles/catalogue";
import type { AccessLog, Consent, Member, Result, Salon, ShareEvent, Style, TryOnSession } from "../types";
import { hashPasswordSync } from "../password";
import { DuplicateError, type NewSalon, type Store, type UsageStats } from "./types";

/** Demo logins (demo mode only). */
export const DEMO_USERS = [
  { username: "demo-owner", password: "tryitnow", role: "owner", name: "Amara (Owner)" },
  { username: "demo-stylist", password: "tryitnow", role: "staff", name: "Ravi" },
] as const;

interface DB {
  salons: Map<string, Salon>;
  members: Map<string, Member & { passwordHash: string }>;
  styles: Map<string, Style>;
  sessions: Map<string, TryOnSession>;
  consents: Map<string, Consent>;
  results: Map<string, Result>;
  shares: ShareEvent[];
  logs: AccessLog[];
}

const now = () => new Date().toISOString();

function seed(): DB {
  const db: DB = {
    salons: new Map(), members: new Map(), styles: new Map(), sessions: new Map(),
    consents: new Map(), results: new Map(), shares: [], logs: [],
  };
  const salon: Salon = {
    id: randomUUID(), slug: "demo", name: "Studio Amara", logoUrl: null, accentColor: "#b08d57",
    bookingUrl: "https://example.com/book", whatsappNumber: "919800000000", city: "Bengaluru",
    creditsTotal: 1000, creditsUsed: 0, active: true,
    disabledStyleIds: [], createdAt: now(),
  };
  db.salons.set(salon.id, salon);
  for (const u of DEMO_USERS) {
    const m = { id: randomUUID(), salonId: salon.id, username: u.username, role: u.role, name: u.name, createdAt: now(), passwordHash: hashPasswordSync(u.password) };
    db.members.set(m.id, m);
  }
  CATALOGUE.forEach((c, i) => {
    db.styles.set(c.id, { ...c, salonId: null, referenceImageUrl: null, active: true, sortOrder: i });
  });
  return db;
}

const g = globalThis as unknown as { __tbycDb?: DB };
const db = (g.__tbycDb ??= seed());
const pub = ({ passwordHash: _p, ...m }: Member & { passwordHash: string }): Member => m;

function mustGet<T>(map: Map<string, T>, id: string, what: string): T {
  const v = map.get(id);
  if (!v) throw new Error(`${what} not found`);
  return v;
}

export const memoryStore: Store = {
  async getSalon(id) { return db.salons.get(id) ?? null; },
  async getSalonBySlug(slug) { return [...db.salons.values()].find((s) => s.slug === slug) ?? null; },
  async listSalons() { return [...db.salons.values()].sort((a, b) => a.name.localeCompare(b.name)); },
  async createSalon(input: NewSalon) {
    if ([...db.salons.values()].some((s) => s.slug === input.slug)) throw new Error("slug already in use");
    const s: Salon = {
      logoUrl: null, accentColor: "#c49a5a", bookingUrl: null, whatsappNumber: null, city: null,
      creditsTotal: 0, creditsUsed: 0, active: true, disabledStyleIds: [],
      ...input, id: randomUUID(), createdAt: now(),
    };
    db.salons.set(s.id, s);
    return s;
  },
  async updateSalon(id, patch) {
    const s = { ...mustGet(db.salons, id, "salon"), ...patch };
    db.salons.set(id, s);
    return s;
  },
  async reserveCredits(salonId, credits) {
    const s = db.salons.get(salonId);
    if (!s || !s.active || s.creditsUsed + credits > s.creditsTotal) return false;
    s.creditsUsed += credits;
    return true;
  },
  async refundCredits(salonId, credits) {
    const s = db.salons.get(salonId);
    if (s) s.creditsUsed = Math.max(0, s.creditsUsed - credits);
  },
  async adjustCredits(salonId, delta) {
    const s = mustGet(db.salons, salonId, "salon");
    s.creditsTotal = Math.max(0, s.creditsTotal + delta);
    return s;
  },

  async listMembers(salonId) { return [...db.members.values()].filter((m) => m.salonId === salonId).map(pub); },
  async getMemberAuth(by) {
    const m = "id" in by ? db.members.get(by.id) : [...db.members.values()].find((x) => x.username === by.username.toLowerCase());
    return m ? { member: pub(m), passwordHash: m.passwordHash } : null;
  },
  async addMember(input) {
    const username = input.username.toLowerCase();
    if ([...db.members.values()].some((m) => m.username === username)) throw new DuplicateError("username taken");
    const m = { ...input, username, id: randomUUID(), createdAt: now() };
    db.members.set(m.id, m);
    return pub(m);
  },
  async setMemberPassword(memberId, passwordHash) {
    const m = db.members.get(memberId);
    if (m) m.passwordHash = passwordHash;
  },
  async removeMember(salonId, memberId) {
    const m = db.members.get(memberId);
    if (m && m.salonId === salonId) db.members.delete(memberId);
  },

  async listStyles(opts = {}) {
    return [...db.styles.values()]
      .filter((s) => s.salonId === null || (opts.salonId != null && s.salonId === opts.salonId))
      .filter((s) => opts.includeInactive || s.active)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
  async getStyle(id) { return db.styles.get(id) ?? null; },
  async upsertStyle(style) { db.styles.set(style.id, style); return style; },

  async createSession(input) {
    const s: TryOnSession = {
      ...input, id: randomUUID(), photoKey: null, photoEmbedding: null, providerState: null, stylistNote: null,
      chosenResultIds: [], shareToken: null, rounds: 0, createdAt: now(), deletedAt: null,
    };
    db.sessions.set(s.id, s);
    return s;
  },
  async getSession(id) { return db.sessions.get(id) ?? null; },
  async getSessionByShareToken(token) { return [...db.sessions.values()].find((s) => s.shareToken === token) ?? null; },
  async updateSession(id, patch) {
    const s = { ...mustGet(db.sessions, id, "session"), ...patch };
    db.sessions.set(id, s);
    return s;
  },
  async listRecentSessions(salonId, limit) {
    return [...db.sessions.values()].filter((s) => s.salonId === salonId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  },
  async listExpiredSessions(at, limit) {
    return [...db.sessions.values()].filter((s) => !s.deletedAt && new Date(s.expiresAt) < at).slice(0, limit);
  },
  async listPendingRemoteCleanup(limit) {
    return [...db.sessions.values()].filter((s) => s.deletedAt && s.providerState).slice(0, limit);
  },
  async createConsent(input) {
    const { ipHash: _ip, ...rest } = input;
    const c: Consent = { ...rest, id: randomUUID(), grantedAt: now(), withdrawnAt: null };
    db.consents.set(c.id, c);
    return c;
  },
  async withdrawConsent(sessionId) {
    for (const c of db.consents.values()) if (c.sessionId === sessionId && !c.withdrawnAt) c.withdrawnAt = now();
  },

  async createResults(rows) {
    return rows.map((r) => {
      const res: Result = {
        ...r, id: randomUUID(), status: "pending", imageKey: null, provider: null, similarity: null,
        attempts: 0, error: null, createdAt: now(), completedAt: null,
      };
      db.results.set(res.id, res);
      return res;
    });
  },
  async getResult(id) { return db.results.get(id) ?? null; },
  async listResults(sessionId) {
    return [...db.results.values()].filter((r) => r.sessionId === sessionId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  async updateResult(id, patch) {
    const r = { ...mustGet(db.results, id, "result"), ...patch };
    db.results.set(id, r);
    return r;
  },
  async claimResult(id) {
    const r = db.results.get(id);
    if (!r || r.status !== "pending") return false;
    r.status = "running";
    return true;
  },

  async addShareEvent(input) { db.shares.push({ ...input, id: randomUUID(), createdAt: now() }); },
  async logAccess(input) { db.logs.push({ ...input, id: randomUUID(), createdAt: now() }); },
  async purgeAccessLogs(olderThan) {
    const before = db.logs.length;
    db.logs = db.logs.filter((l) => new Date(l.createdAt) >= olderThan);
    return before - db.logs.length;
  },
  async usage(salonId, since): Promise<UsageStats> {
    const inRange = (iso: string) => new Date(iso) >= since;
    const sessions = [...db.sessions.values()].filter((s) => s.salonId === salonId && inRange(s.createdAt));
    const results = [...db.results.values()].filter((r) => r.salonId === salonId && inRange(r.createdAt));
    const shares = db.shares.filter((s) => s.salonId === salonId && inRange(s.createdAt));
    return {
      sessions: sessions.length,
      tryOns: results.filter((r) => r.status === "ready").length,
      failed: results.filter((r) => r.status === "failed").length,
      sharedSessions: new Set(shares.map((s) => s.sessionId)).size,
      shareEvents: shares.length,
    };
  },
};
