import type { AccessLog, Consent, Member, Result, Salon, ShareEvent, Style, TryOnSession } from "../types";

export type NewSalon = Pick<Salon, "slug" | "name"> & Partial<Omit<Salon, "id" | "slug" | "name" | "createdAt">>;

export interface UsageStats {
  sessions: number;
  tryOns: number;
  failed: number;
  sharedSessions: number;
  shareEvents: number;
}

/** Data access. Two implementations: in-memory (demo) and Supabase. */
export interface Store {
  // salons
  getSalon(id: string): Promise<Salon | null>;
  getSalonBySlug(slug: string): Promise<Salon | null>;
  listSalons(): Promise<Salon[]>;
  createSalon(input: NewSalon): Promise<Salon>;
  updateSalon(id: string, patch: Partial<Omit<Salon, "id" | "createdAt">>): Promise<Salon>;
  reserveCredits(salonId: string, count: number): Promise<boolean>;
  refundCredits(salonId: string, count: number): Promise<void>;

  // members
  listMembers(salonId: string): Promise<Member[]>;
  membershipsForEmail(email: string): Promise<Member[]>;
  addMember(input: Omit<Member, "id" | "createdAt">): Promise<Member>;
  removeMember(salonId: string, memberId: string): Promise<void>;

  // styles
  listStyles(opts?: { salonId?: string | null; includeInactive?: boolean }): Promise<Style[]>;
  getStyle(id: string): Promise<Style | null>;
  upsertStyle(style: Style): Promise<Style>;

  // sessions + consent
  createSession(input: Pick<TryOnSession, "salonId" | "mode" | "startedBy" | "tokenHash" | "expiresAt">): Promise<TryOnSession>;
  getSession(id: string): Promise<TryOnSession | null>;
  getSessionByShareToken(token: string): Promise<TryOnSession | null>;
  updateSession(id: string, patch: Partial<Omit<TryOnSession, "id">>): Promise<TryOnSession>;
  listRecentSessions(salonId: string, limit: number): Promise<TryOnSession[]>;
  listExpiredSessions(now: Date, limit: number): Promise<TryOnSession[]>;
  createConsent(input: Omit<Consent, "id" | "grantedAt" | "withdrawnAt"> & { ipHash: string | null }): Promise<Consent>;
  withdrawConsent(sessionId: string): Promise<void>;

  // results
  createResults(rows: Pick<Result, "sessionId" | "salonId" | "styleId">[]): Promise<Result[]>;
  getResult(id: string): Promise<Result | null>;
  listResults(sessionId: string): Promise<Result[]>;
  updateResult(id: string, patch: Partial<Omit<Result, "id">>): Promise<Result>;
  /** Atomically move a result from pending to running; false if already claimed. */
  claimResult(id: string): Promise<boolean>;

  // sharing, logs, stats
  addShareEvent(input: Omit<ShareEvent, "id" | "createdAt">): Promise<void>;
  logAccess(input: Omit<AccessLog, "id" | "createdAt">): Promise<void>;
  purgeAccessLogs(olderThan: Date): Promise<number>;
  usage(salonId: string, since: Date): Promise<UsageStats>;
}
