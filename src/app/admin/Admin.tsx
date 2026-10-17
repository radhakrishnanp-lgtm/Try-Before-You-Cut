"use client";
import { useState } from "react";
import { StyleArt } from "@/components/StyleArt";
import { api } from "@/lib/client/api";
import type { UsageStats } from "@/lib/store/types";
import { PLANS, type PlanId, type Salon, type Style } from "@/lib/types";

interface Row { salon: Salon; usage: UsageStats; owners: string[] }
const TABS = ["Salons", "New salon", "Catalogue", "Connections"] as const;
// Rough cost guide at ~$0.04/image and ~Rs 85/$ (identity retries add to this).
const INR_PER_IMAGE = 3.4;

export function Admin({ rows: initial, styles: initialStyles, health }: { rows: Row[]; styles: Style[]; health: { mockAi: boolean; mockIdentity: boolean } }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Salons");
  const [rows, setRows] = useState(initial);
  const [styles, setStyles] = useState(initialStyles);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const flash = (ok: boolean, text: string) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 4000); };

  async function patch(id: string, body: object) {
    try {
      const { salon } = await api<{ salon: Salon }>(`/api/admin/salons/${id}`, { method: "PATCH", json: body });
      setRows(rows.map((r) => (r.salon.id === id ? { ...r, salon } : r)));
      flash(true, `${salon.name} updated`);
    } catch (e) { flash(false, (e as Error).message); }
  }

  const total = rows.reduce((a, r) => a + r.usage.tryOns, 0);

  return (
    <main className="container flow">
      <div className="eyebrow">Platform admin</div>
      <h1>Keshkala console</h1>
      {(health.mockAi || health.mockIdentity) && (
        <div className="notice notice-warn" style={{ marginBottom: 16 }}>
          {health.mockAi && "No AI provider configured (mock images). "}
          {health.mockIdentity && "No face service configured (identity check is simulated). "}
          Set the keys in your environment before going live.
        </div>
      )}
      <div className="stats" style={{ marginBottom: 20 }}>
        <div className="card stat"><div className="num">{rows.length}</div><div className="lbl">Salons</div></div>
        <div className="card stat"><div className="num">{total}</div><div className="lbl">Looks, 30 days</div></div>
        <div className="card stat"><div className="num">₹{Math.round(total * INR_PER_IMAGE).toLocaleString("en-IN")}</div><div className="lbl">Est. AI cost, 30 days</div></div>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {msg && <div className={`notice ${msg.ok ? "" : "notice-bad"}`} style={{ marginBottom: 16 }} role="status">{msg.text}</div>}

      {tab === "Salons" && (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Salon</th><th>Plan</th><th>Credits</th><th>30 days</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map(({ salon: s, usage, owners }) => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong><div className="small muted">/t/{s.slug} · {owners.join(", ") || "no owner"}</div>{!s.active && <span className="badge badge-bad">Paused</span>}</td>
                  <td>
                    <select className="input" style={{ minHeight: 40, padding: "4px 8px" }} value={s.plan} onChange={(e) => patch(s.id, { plan: e.target.value })}>
                      {(Object.keys(PLANS) as PlanId[]).map((p) => <option key={p} value={p}>{PLANS[p].name}</option>)}
                    </select>
                  </td>
                  <td>{s.creditsUsed} / {s.creditsTotal}</td>
                  <td className="small">{usage.sessions} sessions<br />{usage.tryOns} looks · {usage.sessions ? Math.round((usage.sharedSessions / usage.sessions) * 100) : 0}% shared</td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => patch(s.id, { addCredits: 100 })}>+100</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => window.confirm("Start a new billing period? Usage resets to 0.") && patch(s.id, { resetPeriod: true })}>New period</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => patch(s.id, { active: !s.active })}>{s.active ? "Pause" : "Resume"}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "New salon" && <NewSalon onCreated={(s) => { setRows([...rows, { salon: s, usage: { sessions: 0, tryOns: 0, failed: 0, sharedSessions: 0, shareEvents: 0 }, owners: [] }]); setTab("Salons"); flash(true, `${s.name} created. The owner can sign in now.`); }} flash={flash} />}

      {tab === "Catalogue" && <Catalogue styles={styles} setStyles={setStyles} flash={flash} />}

      {tab === "Connections" && <Connections />}
    </main>
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

function NewSalon({ onCreated, flash }: { onCreated: (s: Salon) => void; flash: (ok: boolean, t: string) => void }) {
  const [f, setF] = useState({ name: "", slug: "", city: "", ownerEmail: "", plan: "pilot" as PlanId });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="card stack narrow" style={{ marginInline: 0 }} onSubmit={async (e) => {
      e.preventDefault();
      try { onCreated((await api<{ salon: Salon }>("/api/admin/salons", { method: "POST", json: f })).salon); } catch (err) { flash(false, (err as Error).message); }
    }}>
      <label className="field"><span>Salon name</span><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, slug: f.slug || "" })} onBlur={() => !f.slug && setF({ ...f, slug: f.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })} /></label>
      <label className="field"><span>Link slug (keshkala…/t/<b>{f.slug || "slug"}</b>)</span><input className="input" required pattern="[a-z0-9][a-z0-9-]{1,47}" value={f.slug} onChange={set("slug")} /></label>
      <label className="field"><span>City</span><input className="input" value={f.city} onChange={set("city")} /></label>
      <label className="field"><span>Owner email</span><input className="input" type="email" required value={f.ownerEmail} onChange={set("ownerEmail")} /></label>
      <label className="field"><span>Plan</span>
        <select className="input" value={f.plan} onChange={set("plan")}>
          {(Object.keys(PLANS) as PlanId[]).map((p) => <option key={p} value={p}>{PLANS[p].name} · {PLANS[p].tryOns} try-ons</option>)}
        </select>
      </label>
      <button className="btn btn-accent">Create salon</button>
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
