import { NextResponse } from "next/server";
import { getPrivate, verifyMediaSignature } from "@/lib/blob";

/** Serves private photos/results to holders of a valid, unexpired signed URL. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const k = u.searchParams.get("k") ?? "";
  if (!verifyMediaSignature(k, u.searchParams.get("e") ?? "", u.searchParams.get("s") ?? "")) {
    return new NextResponse("Not found", { status: 404 });
  }
  const blob = await getPrivate(k).catch(() => null);
  if (!blob) return new NextResponse("Gone", { status: 410 });
  return new NextResponse(Buffer.from(blob.bytes), { headers: { "content-type": blob.mime, "cache-control": "private, no-store" } });
}
