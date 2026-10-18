import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { SiteHeader } from "@/components/SiteHeader";
import { staffContext } from "@/lib/auth";
import { config, isDemo } from "@/lib/config";
import { store } from "@/lib/store";
import { Dashboard } from "./Dashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Salon dashboard", robots: { index: false } };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ salon?: string }> }) {
  const ctx = await staffContext();
  if (!ctx) redirect("/login?next=/dashboard");
  const { salon: wanted } = await searchParams;
  const salonId = ctx.member?.salonId ?? (ctx.isAdmin ? wanted : undefined);
  if (!salonId) redirect("/admin");
  const salon = await store.getSalon(salonId);
  if (!salon) redirect(ctx.isAdmin ? "/admin" : "/login");

  const [members, styles, usage30, recent] = await Promise.all([
    store.listMembers(salon.id),
    store.listStyles({ salonId: salon.id, includeInactive: false }),
    store.usage(salon.id, new Date(Date.now() - 30 * 86400_000)),
    store.listRecentSessions(salon.id, 15),
  ]);
  const link = `${config.appUrl.replace(/\/$/, "")}/t/${salon.slug}`;
  const qrSvg = await QRCode.toString(link, { type: "svg", margin: 1, color: { dark: "#0c0b0a", light: "#f4eee5" } });

  return (
    <>
      <SiteHeader
        signedIn
        who={ctx.displayName}
        links={[{ href: ctx.isAdmin ? `/studio?salon=${salon.id}` : "/studio", label: "Open studio" }, ...(ctx.isAdmin ? [{ href: "/admin", label: "Admin" }] : [])]}
      />
      <Dashboard
        salon={salon}
        role={ctx.isAdmin ? "owner" : ctx.member!.role}
        me={ctx.member?.id ?? null}
        members={members}
        styles={styles.map((s) => ({ id: s.id, name: s.name, gender: s.gender, length: s.length, art: s.art, textures: s.textures, custom: s.salonId !== null }))}
        usage30={usage30}
        recent={recent.map((s) => ({ id: s.id, mode: s.mode, createdAt: s.createdAt, rounds: s.rounds, deleted: Boolean(s.deletedAt) || new Date(s.expiresAt) < new Date() }))}
        link={link}
        qrSvg={qrSvg}
        creditsPerImage={config.creditsPerImage}
        studioHref={ctx.isAdmin ? `/studio?salon=${salon.id}` : "/studio"}
        demo={isDemo}
      />
    </>
  );
}
