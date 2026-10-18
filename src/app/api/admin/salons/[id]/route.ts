import { z } from "zod";
import { HttpError, requireAdmin } from "@/lib/auth";
import { config } from "@/lib/config";
import { handler, json } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { store } from "@/lib/store";
import { Password } from "@/lib/validation";

const Patch = z.object({
  active: z.boolean().optional(),
  /** Add (or remove, if negative) photos; converted to credits. */
  addPhotos: z.number().int().min(-100000).max(100000).optional(),
  /** Add raw credits, for odd amounts. */
  addCredits: z.number().int().min(-1000000).max(1000000).optional(),
  /** Reset an owner's password. */
  resetPassword: z.object({ memberId: z.string(), password: Password }).optional(),
});

export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await params;
  let salon = await store.getSalon(id);
  if (!salon) throw new HttpError(404, "Salon not found");
  const body = Patch.parse(await req.json());
  const delta = (body.addPhotos ?? 0) * config.creditsPerImage + (body.addCredits ?? 0);
  if (delta) {
    salon = await store.adjustCredits(id, delta);
    await store.logAccess({ salonId: id, sessionId: null, actor: "admin", action: `credits.adjusted:${delta}` });
  }
  if (body.active !== undefined) salon = await store.updateSalon(id, { active: body.active });
  if (body.resetPassword) {
    const target = (await store.listMembers(id)).find((m) => m.id === body.resetPassword!.memberId);
    if (!target) throw new HttpError(404, "Member not found");
    await store.setMemberPassword(target.id, await hashPassword(body.resetPassword.password));
    await store.logAccess({ salonId: id, sessionId: null, actor: "admin", action: `password.reset:${target.username}` });
  }
  return json({ salon });
});
