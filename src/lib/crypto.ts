import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config, isDemo } from "./config";

function secret(): string {
  if (!isDemo && !process.env.APP_SECRET && process.env.NODE_ENV === "production") {
    throw new Error("APP_SECRET must be set in production");
  }
  return config.appSecret;
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Keyed hash so IPs and tokens are never stored in the clear. */
export function keyedHash(input: string): string {
  return createHmac("sha256", secret()).update(input).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}
