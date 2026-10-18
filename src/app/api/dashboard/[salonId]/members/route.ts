import { z } from "zod";
import { HttpError, requireMember } from "@/lib/auth";
import { handler, json } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { DuplicateError, store } from "@/lib/store";
import { Password, Username } from "@/lib/validation";

type Ctx = { params: Promise<{ salonId: string }> };

const Add = z.object({
  username: Username,
  password: Password,
  name: z.string().trim().max(60).optional(),
  role: z.enum(["owner", "staff"]).default("staff"),
});

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { salonId } = await params;
  await requireMember(salonId, { ownerOnly: true });
  const body = Add.parse(await req.json());
  try {
    const member = await store.addMember({ salonId, username: body.username, name: body.name || null, role: body.role, passwordHash: await hashPassword(body.password) });
    return json({ member });
  } catch (err) {
    if (err instanceof DuplicateError) throw new HttpError(409, "That username is taken. Try another.");
    throw err;
  }
});

const Reset = z.object({ memberId: z.string(), password: Password });

/** Owner sets a new password for a team member (or themselves). */
export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const { salonId } = await params;
  await requireMember(salonId, { ownerOnly: true });
  const { memberId, password } = Reset.parse(await req.json());
  const target = (await store.listMembers(salonId)).find((m) => m.id === memberId);
  if (!target) throw new HttpError(404, "Member not found");
  await store.setMemberPassword(memberId, await hashPassword(password));
  await store.logAccess({ salonId, sessionId: null, actor: "owner", action: `password.reset:${target.username}` });
  return json({ ok: true });
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
