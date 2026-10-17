import { NextResponse } from "next/server";
import { getPrivate, verifyDemoMediaSignature } from "@/lib/blob";
import { isDemo } from "@/lib/config";

/** Demo-mode stand-in for Supabase signed URLs. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const k = u.searchParams.get("k") ?? "";
  if (!isDemo || !verifyDemoMediaSignature(k, u.searchParams.get("e") ?? "", u.searchParams.get("s") ?? "")) {
    return new NextResponse("Not found", { status: 404 });
  }
  const blob = await getPrivate(k);
  if (!blob) return new NextResponse("Gone", { status: 410 });
  return new NextResponse(Buffer.from(blob.bytes), { headers: { "content-type": blob.mime, "cache-control": "private, no-store" } });
}
