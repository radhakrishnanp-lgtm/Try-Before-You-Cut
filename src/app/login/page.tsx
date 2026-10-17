import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { isDemo } from "@/lib/config";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Salon login" };

const ERRORS: Record<string, string> = {
  link: "That sign-in link has expired or was already used. Request a new one.",
  nosalon: "Your email isn't linked to a salon yet. Ask your salon owner to add you.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="narrow flow" style={{ maxWidth: 520 }}>
        <div className="eyebrow">Salon team</div>
        <h1>Sign in</h1>
        <p className="muted">We'll email you a one-time sign-in link. No passwords.</p>
        {error && ERRORS[error] && <div className="notice notice-bad" style={{ marginBottom: 16 }}>{ERRORS[error]}</div>}
        <LoginForm next={next ?? "/dashboard"} demo={isDemo} />
      </main>
    </>
  );
}
