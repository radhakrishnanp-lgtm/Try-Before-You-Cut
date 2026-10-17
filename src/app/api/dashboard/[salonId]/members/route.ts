import { z } from "zod";
import { HttpError, requireMember } from "@/lib/auth";
import { handler, json } from "@/lib/http";
import { store } from "@/lib/store";

type Ctx = { params: Promise<{ salonId: string }> };

const Add = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  name: z.string().trim().max(60).optional(),
  role: z.enum(["owner", "staff"]).default("staff"),
});

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { salonId } = await params;
  await requireMember(salonId, { ownerOnly: true });
  const body = Add.parse(await req.json());
  const member = await store.addMember({ salonId, email: body.email, name: body.name || null, role: body.role });
  return json({ member });
});

export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  const { salonId } = await params;
  const { member: me } = await requireMember(salonId, { ownerOnly: true });
  const memberId = new URL(req.url).searchParams.get("id") ?? "";
  if (me?.id === memberId) throw new HttpError(400, "You can't remove yourself.");
  const members = await store.listMembers(salonId);
  const target = members.find((m) => m.id === memberId);
  if (target?.role === "owner" && members.filter((m) => m.role === "owner").length <= 1) {
    throw new HttpError(400, "A salon needs at least one owner.");
  }
  await store.removeMember(salonId, memberId);
  return json({ ok: true });
});
