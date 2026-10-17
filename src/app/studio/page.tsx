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
  const { salon: salonId } = await searchParams;
  const member = ctx.memberships.find((m) => m.salonId === salonId) ?? ctx.memberships[0];
  if (!member) redirect(ctx.isAdmin ? "/admin" : "/login?error=nosalon");
  const salon = await store.getSalon(member.salonId);
  if (!salon) redirect("/dashboard");
  const styles = await stylesForSalon(salon);
  return <TryOn salon={publicSalon(salon)} styles={styles.map(publicStyle)} mode="studio" staffName={member.name ?? member.email} />;
}
