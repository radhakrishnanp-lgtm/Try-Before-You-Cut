import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { SiteHeader } from "@/components/SiteHeader";
import { staffContext } from "@/lib/auth";
import { config, isDemo } from "@/lib/config";
import { store } from "@/lib/store";
import { PLANS } from "@/lib/types";
import { Dashboard } from "./Dashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Salon dashboard", robots: { index: false } };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ salon?: string }> }) {
  const ctx = await staffContext();
  if (!ctx) redirect("/login?next=/dashboard");
  const { salon: wanted } = await searchParams;
  const member = ctx.memberships.find((m) => m.salonId === wanted) ?? ctx.memberships[0];
  if (!member) redirect(ctx.isAdmin ? "/admin" : "/login?error=nosalon");
  const salon = await store.getSalon(member.salonId);
  if (!salon) redirect("/login?error=nosalon");

  const [members, styles, usage, recent, usage30] = await Promise.all([
    store.listMembers(salon.id),
    store.listStyles({ salonId: salon.id, includeInactive: false }),
    store.usage(salon.id, new Date(salon.periodStart)),
    store.listRecentSessions(salon.id, 15),
    store.usage(salon.id, new Date(Date.now() - 30 * 86400_000)),
  ]);
  const link = `${config.appUrl.replace(/\/$/, "")}/t/${salon.slug}`;
  const qrSvg = await QRCode.toString(link, { type: "svg", margin: 1, color: { dark: "#1c1b19", light: "#00000000" } });

  return (
    <>
      <SiteHeader
        email={ctx.email}
        links={[{ href: `/studio?salon=${salon.id}`, label: "Open studio" }, ...(ctx.isAdmin ? [{ href: "/admin", label: "Admin" }] : [])]}
      />
      <Dashboard
        salon={salon}
        plan={PLANS[salon.plan]}
        role={member.role}
        me={member.id}
        members={members}
        styles={styles.map((s) => ({ id: s.id, name: s.name, gender: s.gender, length: s.length, art: s.art, textures: s.textures, custom: s.salonId !== null }))}
        usage={usage}
        usage30={usage30}
        recent={recent.map((s) => ({ id: s.id, mode: s.mode, createdAt: s.createdAt, rounds: s.rounds, deleted: Boolean(s.deletedAt) || new Date(s.expiresAt) < new Date() }))}
        link={link}
        qrSvg={qrSvg}
        otherSalons={ctx.memberships.filter((m) => m.salonId !== salon.id).map((m) => m.salonId)}
        demo={isDemo}
      />
    </>
  );
}
