import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Tilt } from "@/components/fx/Tilt";
import { SiteHeader } from "@/components/SiteHeader";
import { DEMO_ADMIN_PASSWORD, adminLoginEnabled, staffContext } from "@/lib/auth";
import { config, isDemo } from "@/lib/config";
import { DEMO_USERS } from "@/lib/store/memory";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Salon login" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const ctx = await staffContext();
  const { next } = await searchParams;
  if (ctx) redirect(ctx.isAdmin ? "/admin" : next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
  const demoLogins = isDemo
    ? [
        ...DEMO_USERS.map((u) => ({ label: u.role === "owner" ? "Salon owner" : "Stylist", username: u.username, password: u.password })),
        ...(adminLoginEnabled() && !config.adminPassword && !config.adminPasswordHash ? [{ label: "Platform admin", username: config.adminUsername, password: DEMO_ADMIN_PASSWORD }] : []),
      ]
    : [];
  return (
    <>
      <SiteHeader />
      <main className="narrow flow" style={{ maxWidth: 520 }}>
        <div className="enter">
          <div className="eyebrow">Salon team</div>
          <h1>Welcome <em>back</em>.</h1>
          <p className="muted">Sign in with the username and password your salon was given.</p>
        </div>
        <Tilt className="card" max={4} style={{ marginTop: 18 }}>
          <LoginForm next={next ?? ""} demoLogins={demoLogins} />
        </Tilt>
      </main>
    </>
  );
}
