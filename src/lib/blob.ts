import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { config, isDemo } from "./config";
import { safeEqual, sign } from "./crypto";

/**
 * Image storage. Self-hosted: files on local disk under STORAGE_DIR
 * (private/ for photos and results, public/ for salon logos). Demo: memory.
 * Private files are only reachable through short-lived HMAC-signed URLs.
 */
const g = globalThis as unknown as { __tbycBlobs?: Map<string, { bytes: Uint8Array; mime: string }> };
const mem = (g.__tbycBlobs ??= new Map());

const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

function safeKey(key: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9/_.-]*$/.test(key) || key.includes("..")) throw new Error("invalid storage key");
  return key;
}

function diskPath(area: "private" | "public", key: string) {
  return path.resolve(config.storageDir, area, safeKey(key));
}

async function put(area: "private" | "public", key: string, bytes: Uint8Array, mime: string) {
  if (isDemo) {
    mem.set(`${area}/${safeKey(key)}`, { bytes, mime });
    return;
  }
  const file = diskPath(area, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes, { mode: 0o600 });
}

async function get(area: "private" | "public", key: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (isDemo) return mem.get(`${area}/${safeKey(key)}`) ?? null;
  try {
    const bytes = new Uint8Array(await readFile(diskPath(area, key)));
    return { bytes, mime: MIME[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

export const putPrivate = (key: string, bytes: Uint8Array, mime: string) => put("private", key, bytes, mime);
export const getPrivate = (key: string) => get("private", key);

export async function removePrivate(keys: string[]): Promise<void> {
  for (const key of keys.filter(Boolean)) {
    if (isDemo) mem.delete(`private/${safeKey(key)}`);
    else await rm(diskPath("private", key), { force: true });
  }
}

/** Short-lived URL for a private file. */
export async function signedUrl(key: string, ttlSeconds = 3600): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `/api/media?k=${encodeURIComponent(key)}&e=${exp}&s=${sign(`${key}:${exp}`)}`;
}

export function verifyMediaSignature(key: string, exp: string, sig: string): boolean {
  if (!(Number(exp) > Date.now() / 1000)) return false;
  return safeEqual(sign(`${key}:${exp}`), sig);
}

/** Public branding assets (salon logos). Returns the URL to store. */
export async function putPublic(key: string, bytes: Uint8Array, mime: string): Promise<string> {
  await put("public", key, bytes, mime);
  return `/api/media/public?k=${encodeURIComponent(key)}`;
}

export const getPublic = (key: string) => get("public", key);
