import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, SESSION_COOKIE, login, sessionCookieOptions } from "@/lib/auth";
import { handler } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const Body = z.object({ username: z.string().trim().min(1).max(60), password: z.string().min(1).max(200) });

export const POST = handler(async (req: Request) => {
  const ip = clientIp(req);
  const { username, password } = Body.parse(await req.json());
  // Per IP and per username, so one salon can't be brute-forced from many IPs cheaply.
  if (!rateLimit(`login:${ip}`, 10, 15 * 60_000) || !rateLimit(`login-user:${username.toLowerCase()}`, 10, 15 * 60_000)) {
    throw new HttpError(429, "Too many attempts. Please wait 15 minutes.");
  }
  const result = await login(username, password);
  if (!result) throw new HttpError(401, "Wrong username or password.");
  const res = NextResponse.json({ ok: true, redirect: result.isAdmin ? "/admin" : "/dashboard" });
  res.cookies.set(SESSION_COOKIE, result.cookie, sessionCookieOptions);
  return res;
});
