"use client";
import { useState } from "react";
import { api } from "@/lib/client/api";

export function LoginForm({ next, demo }: { next: string; demo: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(addr: string) {
    setState("sending");
    setError(null);
    try {
      const res = await api<{ demo?: boolean }>("/api/auth/login", { method: "POST", json: { email: addr, next } });
      if (res.demo) {
        window.location.href = addr.startsWith("admin@") ? "/admin" : next;
        return;
      }
      setState("sent");
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div className="card">
        <h3>Check your inbox</h3>
        <p className="muted" style={{ margin: 0 }}>If {email} belongs to a salon team, a sign-in link is on its way. Open it on this device.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); void submit(email); }}>
        <label className="field">
          <span>Work email</span>
          <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yoursalon.in" />
        </label>
        {error && <div className="notice notice-bad" role="alert">{error}</div>}
        <button className="btn btn-accent btn-block" disabled={state === "sending"}>{state === "sending" ? "Sending…" : demo ? "Sign in" : "Email me a sign-in link"}</button>
      </form>
      {demo && (
        <div className="card">
          <div className="eyebrow">Demo mode</div>
          <p className="small muted">No Supabase project is configured, so sign-in is simulated. Pick a demo account:</p>
          <div className="row">
            <button className="btn btn-ghost btn-sm" onClick={() => submit("owner@demo.salon")}>Salon owner</button>
            <button className="btn btn-ghost btn-sm" onClick={() => submit("staff@demo.salon")}>Stylist</button>
            <button className="btn btn-ghost btn-sm" onClick={() => submit("admin@demo.salon")}>Platform admin</button>
          </div>
        </div>
      )}
    </div>
  );
}
