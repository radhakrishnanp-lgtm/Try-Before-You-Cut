import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { handler, json } from "@/lib/http";
import { store } from "@/lib/store";
import { PLANS } from "@/lib/types";

const Create = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,47}$/, "Lowercase letters, numbers and dashes"),
  city: z.string().max(60).optional(),
  ownerEmail: z.email().transform((e) => e.toLowerCase()),
  plan: z.enum(["pilot", "starter", "pro", "chain"]).default("pilot"),
});

export const POST = handler(async (req: Request) => {
  const admin = await requireAdmin();
  const body = Create.parse(await req.json());
  const salon = await store.createSalon({
    name: body.name, slug: body.slug, city: body.city || null, plan: body.plan, creditsTotal: PLANS[body.plan].tryOns,
  });
  await store.addMember({ salonId: salon.id, email: body.ownerEmail, name: null, role: "owner" });
  await store.logAccess({ salonId: salon.id, sessionId: null, actor: `admin:${admin.email}`, action: "salon.created" });
  return json({ salon });
});
