/** Central, typed access to environment configuration (server side). */

export const RETENTION_HOURS = 24;
export const MAX_STYLES_PER_ROUND = 4;
export const MAX_ROUNDS_PER_SESSION = 6;
export const CONSENT_VERSION = "2026-10-v1";
export const ACCESS_LOG_RETENTION_DAYS = 365;

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const config = {
  appUrl: env("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
  appSecret: env("APP_SECRET") ?? "dev-insecure-secret-change-me",
  platformAdmins: (env("PLATFORM_ADMIN_EMAILS") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  supabaseUrl: env("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceKey: env("SUPABASE_SERVICE_ROLE_KEY"),
  aiProviders: (env("AI_PROVIDERS") ?? "gemini,flux").split(",").map((s) => s.trim()).filter(Boolean),
  geminiKey: env("GEMINI_API_KEY"),
  geminiModel: env("GEMINI_IMAGE_MODEL") ?? "gemini-2.5-flash-image",
  replicateToken: env("REPLICATE_API_TOKEN"),
  fluxModel: env("FLUX_MODEL") ?? "black-forest-labs/flux-kontext-pro",
  faceServiceUrl: env("FACE_SERVICE_URL"),
  faceServiceToken: env("FACE_SERVICE_TOKEN"),
  identityThreshold: Number(env("IDENTITY_THRESHOLD") ?? "0.45"),
  cronSecret: env("CRON_SECRET"),
};

/** Demo mode = no Supabase configured. Uses in-memory data and mock AI. */
export const isDemo = !(config.supabaseUrl && config.supabaseAnonKey && config.supabaseServiceKey);

export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  if (isDemo && email.toLowerCase() === "admin@demo.salon") return true;
  return config.platformAdmins.includes(email.toLowerCase());
}
