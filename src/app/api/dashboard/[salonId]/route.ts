import { z } from "zod";
import { HttpError, requireMember } from "@/lib/auth";
import { handler, json } from "@/lib/http";
import { store } from "@/lib/store";
import { PLANS } from "@/lib/types";

type Ctx = { params: Promise<{ salonId: string }> };

const Patch = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  bookingUrl: z.url().max(300).nullable().optional().or(z.literal("").transform(() => null)),
  whatsappNumber: z.string().regex(/^\d{10,15}$/, "Digits only, with country code, e.g. 919812345678").nullable().optional().or(z.literal("").transform(() => null)),
  city: z.string().max(60).nullable().optional(),
  disabledStyleIds: z.array(z.string()).max(500).optional(),
});

/** Owner settings: branding, contact links and which styles are visible. */
export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const { salonId } = await params;
  await requireMember(salonId, { ownerOnly: true });
  const salon = await store.getSalon(salonId);
  if (!salon) throw new HttpError(404, "Salon not found");
  const body = Patch.parse(await req.json());
  if (body.accentColor && !PLANS[salon.plan].branding) throw new HttpError(402, "Custom colours are part of the Pro plan.");
  return json({ salon: await store.updateSalon(salonId, body) });
});
