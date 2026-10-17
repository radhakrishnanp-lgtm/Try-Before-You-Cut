import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_COOKIE, HttpError, demoCookieValue, supabaseServer } from "@/lib/auth";
import { config, isDemo, isPlatformAdmin } from "@/lib/config";
import { handler, json } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { store } from "@/lib/store";

const Body = z.object({ email: z.email().transform((e) => e.toLowerCase()), next: z.string().optional() });

/** Sends a magic link, but only to people who are salon members or platform admins. */
export const POST = handler(async (req: Request) => {
  if (!rateLimit(`login:${clientIp(req)}`, 10, 15 * 60_000)) throw new HttpError(429, "Too many attempts. Please wait a few minutes.");
  const { email, next } = Body.parse(await req.json());
  const known = isPlatformAdmin(email) || (await store.membershipsForEmail(email)).length > 0;

  if (isDemo) {
    if (!known) throw new HttpError(403, "In demo mode use owner@demo.salon, staff@demo.salon or admin@demo.salon.");
    const res = NextResponse.json({ demo: true });
    res.cookies.set(DEMO_COOKIE, demoCookieValue(email), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
    return res;
  }
  // Same response either way so the endpoint doesn't reveal who is a member.
  if (known) {
    const supabase = await supabaseServer();
    const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${config.appUrl}/auth/callback?next=${encodeURIComponent(safeNext)}`, shouldCreateUser: true },
    });
    if (error) throw new HttpError(400, error.message);
  }
  return json({ sent: true });
});
