import { z } from "zod";
import { HttpError, requireAdmin } from "@/lib/auth";
import { config } from "@/lib/config";
import { handler, json } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { DuplicateError, store } from "@/lib/store";
import { Password, Username } from "@/lib/validation";

const Create = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,47}$/, "Lowercase letters, numbers and dashes"),
  city: z.string().max(60).optional(),
  ownerName: z.string().trim().max(60).optional(),
  ownerUsername: Username,
  ownerPassword: Password,
  photos: z.number().int().min(0).max(100000),
});

/** Create a salon with its owner login and a starting number of photos. */
export const POST = handler(async (req: Request) => {
  await requireAdmin();
  const body = Create.parse(await req.json());
  if (await store.getSalonBySlug(body.slug)) throw new HttpError(409, "That link name is already used by another salon.");
  if (await store.getMemberAuth({ username: body.ownerUsername })) throw new HttpError(409, "That username is taken.");
  const salon = await store.createSalon({
    name: body.name, slug: body.slug, city: body.city || null, creditsTotal: body.photos * config.creditsPerImage,
  });
  let owner;
  try {
    owner = await store.addMember({ salonId: salon.id, username: body.ownerUsername, name: body.ownerName || null, role: "owner", passwordHash: await hashPassword(body.ownerPassword) });
  } catch (err) {
    if (err instanceof DuplicateError) throw new HttpError(409, "That username is taken.");
    throw err;
  }
  await store.logAccess({ salonId: salon.id, sessionId: null, actor: "admin", action: `salon.created:${salon.creditsTotal}cr` });
  return json({ salon, owner });
});
