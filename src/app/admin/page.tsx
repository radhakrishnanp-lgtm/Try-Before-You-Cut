import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { staffContext } from "@/lib/auth";
import { usingMockAi } from "@/lib/ai";
import { config } from "@/lib/config";
import { usingMockIdentity } from "@/lib/identity";
import { store } from "@/lib/store";
import { Admin } from "./Admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Platform admin", robots: { index: false } };

export default async function AdminPage() {
  const ctx = await staffContext();
  if (!ctx) redirect("/login?next=/admin");
  if (!ctx.isAdmin) redirect("/dashboard");
  const salons = await store.listSalons();
  const month = new Date(Date.now() - 30 * 86400_000);
  const rows = await Promise.all(
    salons.map(async (s) => ({ salon: s, usage: await store.usage(s.id, month), members: await store.listMembers(s.id) })),
  );
  const styles = await store.listStyles({ includeInactive: true });
  return (
    <>
      <SiteHeader signedIn who="Platform admin" />
      <Admin
        rows={rows}
        styles={styles}
        creditsPerImage={config.creditsPerImage}
        appUrl={config.appUrl.replace(/\/$/, "")}
        health={{ mockAi: usingMockAi(), mockIdentity: usingMockIdentity() }}
      />
    </>
  );
}
