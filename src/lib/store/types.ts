import type { AccessLog, Consent, Member, Result, Salon, ShareEvent, Style, TryOnSession } from "../types";

export type NewSalon = Pick<Salon, "slug" | "name"> & Partial<Omit<Salon, "id" | "slug" | "name" | "createdAt">>;

export interface MemberAuth {
  member: Member;
  passwordHash: string;
}

export class DuplicateError extends Error {}

export interface UsageStats {
  sessions: number;
  tryOns: number;
  failed: number;
  sharedSessions: number;
  shareEvents: number;
}

/** Data access. Two implementations: in-memory (demo) and Postgres (self-hosted). */
export interface Store {
  // salons
  getSalon(id: string): Promise<Salon | null>;
  getSalonBySlug(slug: string): Promise<Salon | null>;
  listSalons(): Promise<Salon[]>;
  createSalon(input: NewSalon): Promise<Salon>;
  updateSalon(id: string, patch: Partial<Omit<Salon, "id" | "createdAt">>): Promise<Salon>;
  /** Atomically spend credits if the balance allows it. */
  reserveCredits(salonId: string, credits: number): Promise<boolean>;
  refundCredits(salonId: string, credits: number): Promise<void>;
  /** Add (or with a negative delta remove) granted credits; never below 0. */
  adjustCredits(salonId: string, delta: number): Promise<Salon>;

  // members
  listMembers(salonId: string): Promise<Member[]>;
  getMemberAuth(by: { id: string } | { username: string }): Promise<MemberAuth | null>;
  /** Throws DuplicateError if the username is taken. */
  addMember(input: Omit<Member, "id" | "createdAt"> & { passwordHash: string }): Promise<Member>;
  setMemberPassword(memberId: string, passwordHash: string): Promise<void>;
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
  /** Erased sessions whose provider copies (Magnific) still need deleting. */
  listPendingRemoteCleanup(limit: number): Promise<TryOnSession[]>;
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
