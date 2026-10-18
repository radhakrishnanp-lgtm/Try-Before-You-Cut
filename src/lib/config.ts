/** Central, typed access to environment configuration (server side). */

export const RETENTION_HOURS = 24;
export const MAX_STYLES_PER_ROUND = 4;
export const MAX_ROUNDS_PER_SESSION = 6;
export const CONSENT_VERSION = "2026-10-v2";
export const ACCESS_LOG_RETENTION_DAYS = 365;

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const config = {
  // Read at runtime (never inlined at build), so one Docker image works for any domain.
  appUrl: (env("APP_URL") ?? env("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000").replace(/\/$/, ""),
  appSecret: env("APP_SECRET") ?? "dev-insecure-secret-change-me",
  // Platform admin login (you). Use ADMIN_PASSWORD_HASH from `npm run hash-password` in production.
  adminUsername: (env("ADMIN_USERNAME") ?? "admin").toLowerCase(),
  adminPassword: env("ADMIN_PASSWORD"),
  adminPasswordHash: env("ADMIN_PASSWORD_HASH"),
  databaseUrl: env("DATABASE_URL"),
  storageDir: env("STORAGE_DIR") ?? "./storage",
  /** Credits charged per generated look (refunded if the look fails). */
  creditsPerImage: Math.max(1, Number(env("CREDITS_PER_IMAGE") ?? "10")),
  aiProviders: (env("AI_PROVIDERS") ?? "magnific,gemini,flux").split(",").map((s) => s.trim()).filter(Boolean),
  geminiKey: env("GEMINI_API_KEY"),
  geminiModel: env("GEMINI_IMAGE_MODEL") ?? "gemini-2.5-flash-image",
  replicateToken: env("REPLICATE_API_TOKEN"),
  fluxModel: env("FLUX_MODEL") ?? "black-forest-labs/flux-kontext-pro",
  // OpenAI-compatible LLM (OpenRouter by default): vision checks
  llmBaseUrl: env("LLM_BASE_URL") ?? "https://openrouter.ai/api/v1",
  llmApiKey: env("LLM_API_KEY") ?? env("OPENROUTER_API_KEY"),
  llmModel: env("LLM_MODEL") ?? "qwen/qwen3.8-omni-flash",
  llmVisionModel: env("LLM_VISION_MODEL"),
  llmReasoning: (env("LLM_REASONING") ?? "1") !== "0",
  llmStream: env("LLM_STREAM") === "1",
  llmIdentityThreshold: Number(env("LLM_IDENTITY_THRESHOLD") ?? "0.75"),
  // Magnific (Freepik) MCP: image generation
  magnificUrl: env("MAGNIFIC_MCP_URL") ?? "https://mcp.magnific.com",
  magnificToken: env("MAGNIFIC_MCP_TOKEN"),
  magnificImageModel: env("MAGNIFIC_IMAGE_MODEL") ?? "imagen-nano-banana-2-1",
  magnificResolution: env("MAGNIFIC_RESOLUTION") ?? "2k",
  /** Portrait output for consultations. "auto" keeps the photo's own ratio. */
  magnificAspectRatio: env("MAGNIFIC_ASPECT_RATIO") ?? "3:4",
  magnificParentFolder: env("MAGNIFIC_PARENT_FOLDER"),
  faceServiceUrl: env("FACE_SERVICE_URL"),
  faceServiceToken: env("FACE_SERVICE_TOKEN"),
  identityThreshold: Number(env("IDENTITY_THRESHOLD") ?? "0.45"),
  cronSecret: env("CRON_SECRET"),
};

/** Demo mode = no DATABASE_URL. In-memory data, demo logins, mock AI unless keys are set. */
export const isDemo = !config.databaseUrl;
