"use client";
import { useState } from "react";
import { StyleArt } from "@/components/StyleArt";
import { Tilt } from "@/components/fx/Tilt";
import { api } from "@/lib/client/api";
import type { UsageStats } from "@/lib/store/types";
import type { Member, Salon, Style } from "@/lib/types";

interface Row { salon: Salon; usage: UsageStats; members: Member[] }
const TABS = ["Salons", "New salon", "Catalogue", "Connections"] as const;

export function Admin({ rows: initial, styles: initialStyles, health, creditsPerImage: cpi, appUrl }: {
  rows: Row[];
  styles: Style[];
  health: { mockAi: boolean; mockIdentity: boolean };
  creditsPerImage: number;
  appUrl: string;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Salons");
  const [rows, setRows] = useState(initial);
  const [styles, setStyles] = useState(initialStyles);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const flash = (ok: boolean, text: string) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 4500); };

  async function patch(id: string, body: object, done?: string) {
    try {
      const { salon } = await api<{ salon: Salon }>(`/api/admin/salons/${id}`, { method: "PATCH", json: body });
      setRows((rs) => rs.map((r) => (r.salon.id === id ? { ...r, salon } : r)));
      flash(true, done ?? `${salon.name} updated`);
      return true;
    } catch (e) {
      flash(false, (e as Error).message);
      return false;
    }
  }

  const looks30 = rows.reduce((a, r) => a + r.usage.tryOns, 0);
  const outstanding = rows.reduce((a, r) => a + Math.max(0, r.salon.creditsTotal - r.salon.creditsUsed), 0);

  return (
    <main className="container flow">
      <div className="enter">
        <div className="eyebrow">Platform admin</div>
        <h1>Salons & <em>credits</em></h1>
      </div>
      {(health.mockAi || health.mockIdentity) && (
        <div className="notice notice-warn" style={{ marginBottom: 16 }}>
          {health.mockAi && "No image provider configured (demo images). "}
          {health.mockIdentity && "No identity check configured (simulated). "}
          Set MAGNIFIC_MCP_TOKEN and LLM_API_KEY before going live, then run Connections.
        </div>
      )}
      <div className="stats" style={{ marginBottom: 22 }}>
        {[
          [rows.length, "Salons"],
          [rows.filter((r) => r.salon.active).length, "Active"],
          [looks30, "Looks, last 30 days"],
          [Math.floor(outstanding / cpi).toLocaleString("en-IN"), "Looks still on balances"],
        ].map(([n, l]) => (
          <Tilt key={String(l)} className="card stat" max={10}>
            <div className="num depth-2">{n}</div>
            <div className="lbl depth-1">{l}</div>
          </Tilt>
        ))}
      </div>
      <div className="tabs" role="tablist">
        {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {msg && <div className={`notice ${msg.ok ? "" : "notice-bad"}`} style={{ marginBottom: 16 }} role="status">{msg.text}</div>}

      {tab === "Salons" && (
        <div className="stack">
          {rows.length === 0 && <div className="card muted">No salons yet. Create one in “New salon”.</div>}
          {rows.map((r) => <SalonRow key={r.salon.id} row={r} cpi={cpi} appUrl={appUrl} patch={patch} />)}
        </div>
      )}

      {tab === "New salon" && (
        <NewSalon
          cpi={cpi}
          appUrl={appUrl}
          flash={flash}
          onCreated={(salon, member) => {
            // Stay on the confirmation card so the login details can be copied.
            setRows((rs) => [...rs, { salon, usage: { sessions: 0, tryOns: 0, failed: 0, sharedSessions: 0, shareEvents: 0 }, members: [member] }]);
          }}
        />
      )}

      {tab === "Catalogue" && <Catalogue styles={styles} setStyles={setStyles} flash={flash} />}

      {tab === "Connections" && <Connections />}
    </main>
  );
}

function SalonRow({ row: { salon: s, usage, members }, cpi, appUrl, patch }: {
  row: Row;
  cpi: number;
  appUrl: string;
  patch: (id: string, body: object, done?: string) => Promise<boolean>;
}) {
  const [photos, setPhotos] = useState("");
  const balance = Math.max(0, s.creditsTotal - s.creditsUsed);
  const left = Math.floor(balance / cpi);
  const pct = s.creditsTotal ? (balance / s.creditsTotal) * 100 : 0;

  async function topUp(sign: 1 | -1) {
    const n = Math.floor(Number(photos));
    if (!n || n < 1) return;
    if (sign < 0 && !window.confirm(`Remove ${n} looks (${n * cpi} credits) from ${s.name}?`)) return;
    if (await patch(s.id, { addPhotos: sign * n }, `${sign > 0 ? "Added" : "Removed"} ${n} looks ${sign > 0 ? "to" : "from"} ${s.name}`)) setPhotos("");
  }
  async function resetPassword(m: Member) {
    const pw = window.prompt(`New password for ${m.username} (at least 8 characters):`);
    if (pw) await patch(s.id, { resetPassword: { memberId: m.id, password: pw } }, `Password reset for ${m.username}`);
  }

  return (
    <Tilt className="card" max={2} style={{ ["--accent" as string]: s.accentColor }}>
      <div className="spread depth-1" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 220 }}>
          <div className="row" style={{ gap: 10 }}>
            <h3 style={{ margin: 0 }}>{s.name}</h3>
            {s.active ? <span className="badge badge-ok">Active</span> : <span className="badge badge-bad">Paused</span>}
          </div>
          <div className="small muted" style={{ marginTop: 4 }}>{appUrl}/t/{s.slug}{s.city ? ` · ${s.city}` : ""}</div>
          <div className="small" style={{ marginTop: 10 }}>
            {members.map((m) => (
              <div key={m.id} className="row" style={{ gap: 8 }}>
                <span>@{m.username} <span className="muted">· {m.role === "owner" ? "owner" : "stylist"}</span></span>
                <button className="btn-link small" onClick={() => resetPassword(m)}>reset password</button>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: "1 1 260px", maxWidth: 420 }}>
          <div className="spread small" style={{ marginBottom: 8 }}>
            <span><strong className="text-gold" style={{ fontStyle: "normal", fontSize: "1.3rem" }}>{left.toLocaleString("en-IN")}</strong> looks left</span>
            <span className="muted">{balance.toLocaleString("en-IN")} / {s.creditsTotal.toLocaleString("en-IN")} credits</span>
          </div>
          <div className="meter"><span style={{ width: `${pct}%` }} /></div>
          <div className="small muted" style={{ marginTop: 8 }}>30 days: {usage.sessions} consultations · {usage.tryOns} looks · {usage.sessions ? Math.round((usage.sharedSessions / usage.sessions) * 100) : 0}% shared</div>
          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <input className="input" style={{ width: 120, minHeight: 42 }} type="number" min={1} placeholder="Looks" value={photos} onChange={(e) => setPhotos(e.target.value)} aria-label="Number of looks" />
            <button className="btn btn-sm" onClick={() => topUp(1)} disabled={!photos}>Add looks</button>
            <button className="btn btn-ghost btn-sm" onClick={() => topUp(-1)} disabled={!photos}>Remove</button>
          </div>
          {photos && Number(photos) > 0 && <div className="small muted" style={{ marginTop: 6 }}>= {(Number(photos) * cpi).toLocaleString("en-IN")} credits</div>}
        </div>
      </div>
      <div className="row depth-1" style={{ marginTop: 16, gap: 8 }}>
        <a className="btn btn-ghost btn-sm" href={`/dashboard?salon=${s.id}`}>Dashboard</a>
        <a className="btn btn-ghost btn-sm" href={`/studio?salon=${s.id}`}>Studio</a>
        <button className="btn btn-ghost btn-sm" onClick={() => patch(s.id, { active: !s.active }, `${s.name} ${s.active ? "paused" : "resumed"}`)}>{s.active ? "Pause salon" : "Resume salon"}</button>
      </div>
    </Tilt>
  );
}

type Step = "llm" | "vision" | "magnific" | "magnific_image" | "pipeline";
const STEPS: { step: Step; label: string; note?: string }[] = [
  { step: "llm", label: "LLM answers", note: "OpenAI-compatible API (OpenRouter by default)" },
  { step: "vision", label: "LLM sees images", note: "Used for photo and identity checks when no face service is set" },
  { step: "magnific", label: "Magnific connected", note: "MCP sign-in and image model available (free)" },
  { step: "magnific_image", label: "Magnific test image", note: "Uses a few Magnific credits" },
  { step: "pipeline", label: "Try-on pipeline", note: "Provider order and identity check in use" },
];

function Connections() {
  const [results, setResults] = useState<Partial<Record<Step, { ok: boolean; detail: string; ms: number } | "running">>>({});
  async function run(step: Step) {
    setResults((r) => ({ ...r, [step]: "running" }));
    try {
      const res = await api<{ ok: boolean; detail: string; ms: number }>("/api/admin/check", { method: "POST", json: { step } });
      setResults((r) => ({ ...r, [step]: res }));
    } catch (e) {
      setResults((r) => ({ ...r, [step]: { ok: false, detail: (e as Error).message, ms: 0 } }));
    }
  }
  return (
    <div className="card stack">
      <div className="spread">
        <h3 style={{ margin: 0 }}>Check connections</h3>
        <button className="btn btn-accent btn-sm" onClick={() => STEPS.filter((s) => s.step !== "magnific_image").forEach((s) => void run(s.step))}>Run free checks</button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <tbody>
            {STEPS.map((s) => {
              const r = results[s.step];
              return (
                <tr key={s.step}>
                  <td><strong>{s.label}</strong><div className="small muted">{s.note}</div></td>
                  <td style={{ width: "50%" }}>
                    {r === "running" ? <span className="small muted">Checking…</span> : r ? (
                      <span className="small"><span className={`badge ${r.ok ? "badge-ok" : "badge-bad"}`}>{r.ok ? "OK" : "Problem"}</span> {r.detail} <span className="muted">({(r.ms / 1000).toFixed(1)} s)</span></span>
                    ) : null}
                  </td>
                  <td style={{ textAlign: "right" }}><button className="btn btn-ghost btn-sm" disabled={r === "running"} onClick={() => run(s.step)}>Check</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function randomPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = new Uint32Array(12);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => chars[n % chars.length]).join("");
}

function NewSalon({ onCreated, flash, cpi, appUrl }: {
  onCreated: (s: Salon, owner: Member) => void;
  flash: (ok: boolean, t: string) => void;
  cpi: number;
  appUrl: string;
}) {
  const [f, setF] = useState({ name: "", slug: "", city: "", ownerName: "", ownerUsername: "", ownerPassword: randomPassword(), photos: "100" });
  const [created, setCreated] = useState<{ salon: Salon; username: string; password: string } | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

  if (created) {
    return (
      <div className="card stack narrow" style={{ marginInline: 0 }}>
        <div className="eyebrow">Salon created</div>
        <h3>{created.salon.name}</h3>
        <p className="muted small">Send these to the salon owner privately. The password isn't shown again; you can reset it from the Salons tab.</p>
        <div className="card" style={{ padding: 16, fontFamily: "ui-monospace, monospace", fontSize: ".95rem" }}>
          Login: {appUrl}/login<br />Username: {created.username}<br />Password: {created.password}<br />Customer link: {appUrl}/t/{created.salon.slug}
        </div>
        <div className="row">
          <button className="btn btn-sm" onClick={() => navigator.clipboard.writeText(`Try-Before-You-Cut login\n${appUrl}/login\nUsername: ${created.username}\nPassword: ${created.password}\nCustomer link: ${appUrl}/t/${created.salon.slug}`).then(() => flash(true, "Copied"))}>Copy details</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setCreated(null); setSlugEdited(false); setF({ name: "", slug: "", city: "", ownerName: "", ownerUsername: "", ownerPassword: randomPassword(), photos: "100" }); }}>Create another</button>
        </div>
      </div>
    );
  }

  return (
    <form className="grid-2" style={{ alignItems: "start" }} onSubmit={async (e) => {
      e.preventDefault();
      try {
        const res = await api<{ salon: Salon; owner: Member }>("/api/admin/salons", {
          method: "POST",
          json: { name: f.name, slug: f.slug, city: f.city, ownerName: f.ownerName, ownerUsername: f.ownerUsername, ownerPassword: f.ownerPassword, photos: Number(f.photos) || 0 },
        });
        onCreated(res.salon, res.owner);
        setCreated({ salon: res.salon, username: f.ownerUsername.toLowerCase(), password: f.ownerPassword });
        flash(true, `${res.salon.name} created`);
      } catch (err) { flash(false, (err as Error).message); }
    }}>
      <div className="card stack">
        <h3>Salon</h3>
        <label className="field"><span>Salon name</span><input className="input" required value={f.name} onChange={(e) => setF((cur) => ({ ...cur, name: e.target.value, slug: slugEdited ? cur.slug : slugify(e.target.value) }))} /></label>
        <label className="field"><span>Customer link: {appUrl}/t/<b>{f.slug || "salon-name"}</b></span><input className="input" required pattern="[a-z0-9][a-z0-9\-]{1,47}" value={f.slug} onChange={(e) => { setSlugEdited(true); setF((cur) => ({ ...cur, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })); }} onBlur={() => setF((cur) => ({ ...cur, slug: slugify(cur.slug) }))} /></label>
        <label className="field"><span>City</span><input className="input" value={f.city} onChange={set("city")} /></label>
        <label className="field"><span>Looks to start with ({cpi} credits each)</span><input className="input" type="number" min={0} required value={f.photos} onChange={set("photos")} /></label>
        <div className="small muted">= {((Number(f.photos) || 0) * cpi).toLocaleString("en-IN")} credits</div>
      </div>
      <div className="card stack">
        <h3>Owner login</h3>
        <label className="field"><span>Owner name</span><input className="input" value={f.ownerName} onChange={set("ownerName")} /></label>
        <label className="field"><span>Username</span><input className="input" required autoCapitalize="none" pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{2,39}" value={f.ownerUsername} onChange={set("ownerUsername")} placeholder={f.slug || "salon-owner"} /></label>
        <label className="field"><span>Password</span>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <input className="input" required minLength={8} value={f.ownerPassword} onChange={set("ownerPassword")} style={{ fontFamily: "ui-monospace, monospace" }} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setF({ ...f, ownerPassword: randomPassword() })}>New</button>
          </div>
        </label>
        <button className="btn">Create salon</button>
      </div>
    </form>
  );
}

function Catalogue({ styles, setStyles, flash }: { styles: Style[]; setStyles: (s: Style[]) => void; flash: (ok: boolean, t: string) => void }) {
  const [editing, setEditing] = useState<Style | null>(null);
  async function save(s: Style) {
    try {
      const { style } = await api<{ style: Style }>("/api/admin/styles", { method: "PUT", json: s });
      setStyles(styles.some((x) => x.id === style.id) ? styles.map((x) => (x.id === style.id ? style : x)) : [...styles, style]);
      setEditing(null);
      flash(true, `${style.name} saved`);
    } catch (e) { flash(false, (e as Error).message); }
  }
  if (editing) return <StyleEditor style={editing} onSave={save} onCancel={() => setEditing(null)} />;
  return (
    <div className="stack">
      <div className="spread">
        <p className="small muted" style={{ margin: 0 }}>{styles.filter((s) => s.active).length} active global styles. Prompts describe the hair only; identity guardrails are added automatically.</p>
        <button className="btn btn-accent btn-sm" onClick={() => setEditing({ id: "", salonId: null, name: "", gender: "women", length: "medium", textures: ["straight", "wavy", "curly"], description: "", prompt: "", art: { top: 0.5, sides: "shoulder", fringe: "none" }, referenceImageUrl: null, active: true, sortOrder: styles.length })}>Add style</button>
      </div>
      <div className="toggle-list">
        {styles.map((s) => (
          <button key={s.id} className="toggle-item" style={{ textAlign: "left", opacity: s.active ? 1 : 0.5 }} onClick={() => setEditing(s)}>
            <StyleArt art={s.art} texture={s.textures[0]} title={s.name} />
            <span><strong style={{ display: "block", fontSize: ".95rem" }}>{s.name}</strong><span className="small muted">{s.gender} · {s.length}{s.active ? "" : " · off"}</span></span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StyleEditor({ style, onSave, onCancel }: { style: Style; onSave: (s: Style) => void; onCancel: () => void }) {
  const [s, setS] = useState(style);
  const isNew = !style.id;
  return (
    <form className="grid-2" style={{ alignItems: "start" }} onSubmit={(e) => { e.preventDefault(); onSave(s); }}>
      <div className="card stack">
        <label className="field"><span>ID</span><input className="input" required pattern="[a-z0-9-]{3,60}" disabled={!isNew} value={s.id} onChange={(e) => setS({ ...s, id: e.target.value })} placeholder="w-new-style" /></label>
        <label className="field"><span>Name</span><input className="input" required value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></label>
        <div className="row">
          <select className="input" style={{ flex: 1 }} value={s.gender} onChange={(e) => setS({ ...s, gender: e.target.value as Style["gender"] })}><option value="women">Women</option><option value="men">Men</option></select>
          <select className="input" style={{ flex: 1 }} value={s.length} onChange={(e) => setS({ ...s, length: e.target.value as Style["length"] })}><option>short</option><option>medium</option><option>long</option></select>
        </div>
        <div className="row">
          {(["straight", "wavy", "curly"] as const).map((t) => (
            <label key={t} className="small row" style={{ gap: 6 }}><input type="checkbox" checked={s.textures.includes(t)} onChange={(e) => setS({ ...s, textures: e.target.checked ? [...s.textures, t] : s.textures.filter((x) => x !== t) })} />{t}</label>
          ))}
        </div>
        <label className="field"><span>Customer description</span><input className="input" maxLength={200} value={s.description} onChange={(e) => setS({ ...s, description: e.target.value })} /></label>
        <label className="field"><span>Generation prompt (hair only)</span><textarea className="input" required minLength={20} value={s.prompt} onChange={(e) => setS({ ...s, prompt: e.target.value })} /></label>
        <label className="field"><span>Licensed reference image URL (optional)</span><input className="input" type="url" value={s.referenceImageUrl ?? ""} onChange={(e) => setS({ ...s, referenceImageUrl: e.target.value || null })} /></label>
        <label className="check"><input type="checkbox" checked={s.active} onChange={(e) => setS({ ...s, active: e.target.checked })} /><span>Active</span></label>
        <div className="row"><button className="btn btn-accent">Save</button><button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button></div>
      </div>
      <div className="card stack">
        <div style={{ width: 200, margin: "0 auto" }}><StyleArt art={s.art} texture={s.textures[0]} /></div>
        <label className="field"><span>Crown volume</span><input type="range" min={0} max={1} step={0.05} value={s.art.top} onChange={(e) => setS({ ...s, art: { ...s.art, top: Number(e.target.value) } })} /></label>
        <label className="field"><span>Sides / length</span>
          <select className="input" value={s.art.sides} onChange={(e) => setS({ ...s, art: { ...s.art, sides: e.target.value as Style["art"]["sides"] } })}>
            {["faded", "short", "ear", "jaw", "shoulder", "chest"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className="field"><span>Fringe</span>
          <select className="input" value={s.art.fringe} onChange={(e) => setS({ ...s, art: { ...s.art, fringe: e.target.value as Style["art"]["fringe"] } })}>
            {["none", "straight", "side", "curtain", "textured", "swept-back"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className="field"><span>Extra</span>
          <select className="input" value={s.art.extra ?? ""} onChange={(e) => setS({ ...s, art: { ...s.art, extra: (e.target.value || undefined) as Style["art"]["extra"] } })}>
            <option value="">none</option><option>bun</option><option>quiff</option><option>hawk</option>
          </select>
        </label>
      </div>
    </form>
  );
}
