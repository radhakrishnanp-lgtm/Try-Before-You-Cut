"use client";
import { useState } from "react";
import { api } from "@/lib/client/api";

export function LoginForm({ next, demoLogins }: { next: string; demoLogins: { label: string; username: string; password: string }[] }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(u: string, p: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ redirect: string }>("/api/auth/login", { method: "POST", json: { username: u, password: p } });
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") && res.redirect !== "/admin" ? next : res.redirect;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="stack depth-1">
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void submit(username, password); }}>
        <label className="field">
          <span>Username</span>
          <input className="input" required autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your-salon" />
        </label>
        <label className="field">
          <span>Password</span>
          <div style={{ position: "relative" }}>
            <input className="input" required type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingRight: 80 }} />
            <button type="button" className="btn-link small" style={{ position: "absolute", right: 14, top: 16 }} onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button>
          </div>
        </label>
        {error && <div className="notice notice-bad" role="alert">{error}</div>}
        <button className="btn btn-block" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="small muted center" style={{ margin: 0 }}>Forgot your password? Ask your salon owner or Try-Before-You-Cut support to reset it.</p>
      {demoLogins.length > 0 && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
          <div className="eyebrow">Demo mode</div>
          <div className="row">
            {demoLogins.map((d) => (
              <button key={d.username} type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => submit(d.username, d.password)}>
                {d.label}
              </button>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
            {demoLogins.map((d) => `${d.username} / ${d.password}`).join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}
