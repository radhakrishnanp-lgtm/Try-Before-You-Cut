import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TryOn } from "@/components/tryon/TryOn";
import { staffContext } from "@/lib/auth";
import { publicSalon, publicStyle } from "@/lib/public";
import { stylesForSalon } from "@/lib/sessions";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Studio", robots: { index: false } };

/** In-salon, stylist-guided flow on the salon tablet. */
export default async function Studio({ searchParams }: { searchParams: Promise<{ salon?: string }> }) {
  const ctx = await staffContext();
  if (!ctx) redirect("/login?next=/studio");
  const { salon: wanted } = await searchParams;
  // Members use their own salon; the platform admin can open any salon's studio.
  const salonId = ctx.member?.salonId ?? (ctx.isAdmin ? wanted : undefined);
  if (!salonId) redirect("/admin");
  const salon = await store.getSalon(salonId);
  if (!salon) redirect(ctx.isAdmin ? "/admin" : "/login");
  const styles = await stylesForSalon(salon);
  return <TryOn salon={publicSalon(salon)} styles={styles.map(publicStyle)} mode="studio" staffName={ctx.displayName} />;
}
