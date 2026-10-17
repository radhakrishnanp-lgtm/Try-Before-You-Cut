import { NextResponse } from "next/server";
import { DEMO_COOKIE, supabaseServer } from "@/lib/auth";
import { isDemo } from "@/lib/config";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  if (isDemo) res.cookies.delete(DEMO_COOKIE);
  else await (await supabaseServer()).auth.signOut();
  return res;
}
