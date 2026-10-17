import { z } from "zod";
import { HttpError, requireAdmin } from "@/lib/auth";
import { handler, json } from "@/lib/http";
import { store } from "@/lib/store";
import { PLANS } from "@/lib/types";

const Patch = z.object({
  plan: z.enum(["pilot", "starter", "pro", "chain"]).optional(),
  active: z.boolean().optional(),
  addCredits: z.number().int().min(-10000).max(100000).optional(),
  resetPeriod: z.boolean().optional(),
});

/** Plan changes, credit top-ups and starting a new billing period. */
export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const salon = await store.getSalon(id);
  if (!salon) throw new HttpError(404, "Salon not found");
  const body = Patch.parse(await req.json());
  const patch: Parameters<typeof store.updateSalon>[1] = {};
  if (body.plan) patch.plan = body.plan;
  if (body.active !== undefined) patch.active = body.active;
  if (body.resetPeriod) {
    patch.creditsUsed = 0;
    patch.creditsTotal = PLANS[body.plan ?? salon.plan].tryOns;
    patch.periodStart = new Date().toISOString();
  }
  if (body.addCredits) patch.creditsTotal = Math.max(0, (patch.creditsTotal ?? salon.creditsTotal) + body.addCredits);
  const updated = await store.updateSalon(id, patch);
  await store.logAccess({ salonId: id, sessionId: null, actor: `admin:${admin.email}`, action: `salon.updated:${Object.keys(patch).join(",")}` });
  return json({ salon: updated });
});
