import { HttpError, requireMember } from "@/lib/auth";
import { putPublic } from "@/lib/blob";
import { randomToken } from "@/lib/crypto";
import { handler, json } from "@/lib/http";
import { sniffImage } from "@/lib/image-meta";
import { store } from "@/lib/store";
import { PLANS } from "@/lib/types";

export const POST = handler(async (req: Request, { params }: { params: Promise<{ salonId: string }> }) => {
  const { salonId } = await params;
  await requireMember(salonId, { ownerOnly: true });
  const salon = await store.getSalon(salonId);
  if (!salon) throw new HttpError(404, "Salon not found");
  if (!PLANS[salon.plan].branding) throw new HttpError(402, "Logo branding is part of the Pro plan.");
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength > 2 * 1024 * 1024) throw new HttpError(413, "Logo must be under 2 MB.");
  // SVG is deliberately not accepted: it can carry script.
  const meta = sniffImage(bytes);
  if (!meta) throw new HttpError(415, "Please upload a PNG, JPEG or WebP logo.");
  const url = await putPublic(`${salonId}/logo-${randomToken(6)}.${meta.mime.split("/")[1]}`, bytes, meta.mime);
  return json({ salon: await store.updateSalon(salonId, { logoUrl: url }) });
});
