import { config, isDemo } from "./config";
import { sign, safeEqual } from "./crypto";
import { adminClient } from "./store/supabase";

/**
 * Private image storage. Supabase Storage (private bucket + signed URLs) in
 * production; an in-memory map with HMAC-signed URLs in demo mode.
 */
const BUCKET = "tryon";
const BRANDING = "branding";

const g = globalThis as unknown as { __keshkalaBlobs?: Map<string, { bytes: Uint8Array; mime: string }> };
const mem = (g.__keshkalaBlobs ??= new Map());

export async function putPrivate(key: string, bytes: Uint8Array, mime: string): Promise<void> {
  if (isDemo) {
    mem.set(key, { bytes, mime });
    return;
  }
  const { error } = await adminClient().storage.from(BUCKET).upload(key, bytes, { contentType: mime, upsert: true });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
}

export async function getPrivate(key: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (isDemo) return mem.get(key) ?? null;
  const { data, error } = await adminClient().storage.from(BUCKET).download(key);
  if (error || !data) return null;
  return { bytes: new Uint8Array(await data.arrayBuffer()), mime: data.type || "image/jpeg" };
}

export async function removePrivate(keys: string[]): Promise<void> {
  const list = keys.filter(Boolean);
  if (list.length === 0) return;
  if (isDemo) {
    list.forEach((k) => mem.delete(k));
    return;
  }
  const { error } = await adminClient().storage.from(BUCKET).remove(list);
  if (error) throw new Error(`storage delete failed: ${error.message}`);
}

/** Short-lived URL for a private object. */
export async function signedUrl(key: string, ttlSeconds = 3600): Promise<string> {
  if (isDemo) {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    return `/api/media?k=${encodeURIComponent(key)}&e=${exp}&s=${sign(`${key}:${exp}`)}`;
  }
  const { data, error } = await adminClient().storage.from(BUCKET).createSignedUrl(key, ttlSeconds);
  if (error || !data) throw new Error(`could not sign url: ${error?.message}`);
  return data.signedUrl;
}

export function verifyDemoMediaSignature(key: string, exp: string, sig: string): boolean {
  if (Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sign(`${key}:${exp}`), sig);
}

/** Public branding assets (salon logos). */
export async function putPublic(key: string, bytes: Uint8Array, mime: string): Promise<string> {
  if (isDemo) {
    mem.set(`public/${key}`, { bytes, mime });
    return `/api/media/public?k=${encodeURIComponent(`public/${key}`)}`;
  }
  const { error } = await adminClient().storage.from(BRANDING).upload(key, bytes, { contentType: mime, upsert: true });
  if (error) throw new Error(`logo upload failed: ${error.message}`);
  return adminClient().storage.from(BRANDING).getPublicUrl(key).data.publicUrl;
}

export function getDemoPublic(key: string) {
  return key.startsWith("public/") ? mem.get(key) ?? null : null;
}

export const appUrl = config.appUrl;
