import { NextResponse } from "next/server";
import { runCleanup } from "@/lib/cleanup";
import { config } from "@/lib/config";
import { safeEqual } from "@/lib/crypto";

export const maxDuration = 300;

/** Hourly: erase sessions past their 24h expiry and prune old access logs. */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!config.cronSecret || !safeEqual(auth, `Bearer ${config.cronSecret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runCleanup());
}
