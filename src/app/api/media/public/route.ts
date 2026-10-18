import { NextResponse } from "next/server";
import { getPublic } from "@/lib/blob";

export async function GET(req: Request) {
  const blob = await getPublic(new URL(req.url).searchParams.get("k") ?? "").catch(() => null);
  if (!blob) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(blob.bytes), { headers: { "content-type": blob.mime, "cache-control": "public, max-age=300" } });
}
