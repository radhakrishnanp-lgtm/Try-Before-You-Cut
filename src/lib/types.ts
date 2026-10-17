export type Gender = "men" | "women";
export type Length = "short" | "medium" | "long";
export type Texture = "straight" | "wavy" | "curly";
export type PlanId = "pilot" | "starter" | "pro" | "chain";
export type Role = "owner" | "staff";
export type SessionMode = "studio" | "remote";
export type ResultStatus = "pending" | "running" | "ready" | "failed";

/** Parameters that drive the original line-art thumbnail for a style. */
export interface StyleArt {
  top: number; // 0..1 crown volume
  sides: "faded" | "short" | "ear" | "jaw" | "shoulder" | "chest";
  fringe: "none" | "straight" | "side" | "curtain" | "textured" | "swept-back";
  extra?: "bun" | "quiff" | "hawk";
}

export interface Style {
  id: string;
  salonId: string | null; // null = global catalogue
  name: string;
  gender: Gender;
  length: Length;
  textures: Texture[];
  description: string;
  prompt: string;
  art: StyleArt;
  referenceImageUrl: string | null;
  active: boolean;
  sortOrder: number;
}

export interface Salon {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  accentColor: string;
  bookingUrl: string | null;
  whatsappNumber: string | null;
  city: string | null;
  plan: PlanId;
  creditsTotal: number; // allowance for the current period
  creditsUsed: number;
  periodStart: string;
  active: boolean;
  disabledStyleIds: string[];
  createdAt: string;
}

export interface Member {
  id: string;
  salonId: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: string;
}

export interface Consent {
  id: string;
  sessionId: string;
  salonId: string;
  version: string;
  textHash: string;
  isMinor: boolean;
  guardianConsent: boolean;
  grantedAt: string;
  withdrawnAt: string | null;
}

export interface TryOnSession {
  id: string;
  salonId: string;
  mode: SessionMode;
  startedBy: string | null; // member id for studio sessions
  tokenHash: string;
  photoKey: string | null;
  photoEmbedding: number[] | null;
  /** Remote copies held by image providers (e.g. Magnific folder); erased with the session. */
  providerState: import("./ai/types").ProviderState | null;
  stylistNote: string | null;
  chosenResultIds: string[];
  shareToken: string | null;
  rounds: number;
  createdAt: string;
  expiresAt: string;
  deletedAt: string | null;
}

export interface Result {
  id: string;
  sessionId: string;
  salonId: string;
  styleId: string;
  status: ResultStatus;
  imageKey: string | null;
  provider: string | null;
  similarity: number | null;
  attempts: number;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ShareEvent {
  id: string;
  sessionId: string;
  salonId: string;
  channel: "whatsapp" | "native" | "download" | "board" | "link";
  createdAt: string;
}

export interface AccessLog {
  id: string;
  salonId: string | null;
  sessionId: string | null;
  actor: string; // "customer", "member:<id>", "share", "system", "admin:<email>"
  action: string;
  createdAt: string;
}

export const PLANS: Record<PlanId, { name: string; priceInr: number | null; tryOns: number; branding: boolean; multiDevice: boolean }> = {
  pilot: { name: "Pilot (14 days)", priceInr: 0, tryOns: 100, branding: true, multiDevice: true },
  starter: { name: "Starter", priceInr: 1999, tryOns: 300, branding: false, multiDevice: false },
  pro: { name: "Pro", priceInr: 4999, tryOns: 1000, branding: true, multiDevice: true },
  chain: { name: "Chain", priceInr: null, tryOns: 5000, branding: true, multiDevice: true },
};
