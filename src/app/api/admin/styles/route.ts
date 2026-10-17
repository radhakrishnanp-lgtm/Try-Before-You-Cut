import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { handler, json } from "@/lib/http";
import { store } from "@/lib/store";

const StyleBody = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,60}$/),
  name: z.string().trim().min(2).max(60),
  gender: z.enum(["men", "women"]),
  length: z.enum(["short", "medium", "long"]),
  textures: z.array(z.enum(["straight", "wavy", "curly"])).min(1),
  description: z.string().max(200),
  prompt: z.string().min(20).max(1000),
  art: z.object({
    top: z.number().min(0).max(1),
    sides: z.enum(["faded", "short", "ear", "jaw", "shoulder", "chest"]),
    fringe: z.enum(["none", "straight", "side", "curtain", "textured", "swept-back"]),
    extra: z.enum(["bun", "quiff", "hawk"]).optional(),
  }),
  referenceImageUrl: z.url().nullable().default(null),
  active: z.boolean(),
  sortOrder: z.number().int(),
});

/** Create or update a global catalogue style. */
export const PUT = handler(async (req: Request) => {
  await requireAdmin();
  const body = StyleBody.parse(await req.json());
  const existing = await store.getStyle(body.id);
  const style = await store.upsertStyle({ ...body, salonId: existing?.salonId ?? null });
  return json({ style });
});
