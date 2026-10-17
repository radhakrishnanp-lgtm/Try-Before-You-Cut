import { HttpError } from "@/lib/auth";
import { handler, json } from "@/lib/http";
import { publicSalon, publicStyle } from "@/lib/public";
import { stylesForSalon } from "@/lib/sessions";
import { store } from "@/lib/store";

export const GET = handler(async (_req: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  const salon = await store.getSalonBySlug(slug);
  if (!salon || !salon.active) throw new HttpError(404, "Salon not found");
  const styles = await stylesForSalon(salon);
  return json({ salon: publicSalon(salon), styles: styles.map(publicStyle) });
});
