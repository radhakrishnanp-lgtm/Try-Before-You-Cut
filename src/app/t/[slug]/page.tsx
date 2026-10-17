import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TryOn } from "@/components/tryon/TryOn";
import { publicSalon, publicStyle } from "@/lib/public";
import { stylesForSalon } from "@/lib/sessions";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const salon = await store.getSalonBySlug((await params).slug);
  return { title: salon ? `Try a new look at ${salon.name}` : "Salon not found", robots: { index: false } };
}

/** At-home flow: opened from the salon's link or QR code. */
export default async function SalonTryOn({ params }: Props) {
  const salon = await store.getSalonBySlug((await params).slug);
  if (!salon || !salon.active) notFound();
  const styles = await stylesForSalon(salon);
  return <TryOn salon={publicSalon(salon)} styles={styles.map(publicStyle)} mode="remote" />;
}
