import { z } from "zod";
import { HttpError, requireMember } from "@/lib/auth";
import { runCleanup } from "@/lib/cleanup";
import { isDemo } from "@/lib/config";
import { handler, json } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { startSession } from "@/lib/sessions";
import { store } from "@/lib/store";

const Body = z.object({
  salonSlug: z.string().min(1),
  mode: z.enum(["studio", "remote"]),
  consent: z.literal(true),
  isMinor: z.boolean(),
  guardianConsent: z.boolean(),
});

export const POST = handler(async (req: Request) => {
  const ip = clientIp(req);
  if (!rateLimit(`session:${ip}`, 20, 60 * 60_000)) throw new HttpError(429, "Too many sessions from this device. Please try later.");
  const body = Body.parse(await req.json());
  const salon = await store.getSalonBySlug(body.salonSlug);
  if (!salon) throw new HttpError(404, "Salon not found");
  let startedBy: string | null = null;
  if (body.mode === "studio") {
    const { member } = await requireMember(salon.id);
    startedBy = member?.id ?? null;
  }
  const { session, token } = await startSession({
    salon, mode: body.mode, startedBy, isMinor: body.isMinor, guardianConsent: body.guardianConsent, ip,
  });
  // Demo mode has no cron; sweep expired sessions opportunistically.
  if (isDemo) void runCleanup().catch(() => undefined);
  return json({ sessionId: session.id, token, expiresAt: session.expiresAt });
});
