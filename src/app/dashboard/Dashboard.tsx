"use client";
import { useMemo, useState } from "react";
import { StyleArt } from "@/components/StyleArt";
import { api } from "@/lib/client/api";
import type { UsageStats } from "@/lib/store/types";
import type { Gender, Length, Member, PLANS, Role, Salon, StyleArt as Art, Texture } from "@/lib/types";

type Plan = (typeof PLANS)[keyof typeof PLANS];
interface StyleRow { id: string; name: string; gender: Gender; length: Length; art: Art; textures: Texture[]; custom: boolean }
interface SessionRow { id: string; mode: "studio" | "remote"; createdAt: string; rounds: number; deleted: boolean }

const TABS = ["Overview", "Branding", "Styles", "Team"] as const;
const SWATCHES = ["#b08d57", "#8c5a3c", "#7a2e3a", "#2f5d50", "#36507a", "#5b4a7a", "#1c1b19"];

export function Dashboard(props: {
  salon: Salon;
  plan: Plan;
  role: Role;
  me: string;
  members: Member[];
  styles: StyleRow[];
  usage: UsageStats;
  usage30: UsageStats;
  recent: SessionRow[];
  link: string;
  qrSvg: string;
  otherSalons: string[];
  demo: boolean;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [salon, setSalon] = useState(props.salon);
  const [members, setMembers] = useState(props.members);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const owner = props.role === "owner";

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 3500);
  };

  async function save(patch: Partial<Salon>) {
    try {
      const { salon: s } = await api<{ salon: Salon }>(`/api/dashboard/${salon.id}`, { method: "PATCH", json: patch });
      setSalon(s);
      flash(true, "Saved");
    } catch (e) {
      flash(false, (e as Error).message);
    }
  }

  const left = Math.max(0, salon.creditsTotal - salon.creditsUsed);
  const pct = Math.min(100, (salon.creditsUsed / Math.max(1, salon.creditsTotal)) * 100);
  const shareRate = props.usage30.sessions ? Math.round((props.usage30.sharedSessions / props.usage30.sessions) * 100) : 0;

  return (
    <main className="container flow" style={{ ["--accent" as string]: salon.accentColor }}>
      <div className="spread" style={{ marginBottom: 16 }}>
        <div>
          <div className="eyebrow">{props.plan.name} plan · {owner ? "Owner" : "Stylist"}</div>
          <h1 style={{ marginBottom: 0 }}>{salon.name}</h1>
        </div>
        <a className="btn btn-accent" href={`/studio?salon=${salon.id}`}>Start a consultation</a>
      </div>
      {props.demo && <div className="notice notice-warn" style={{ marginBottom: 16 }}>Demo mode: data is kept in memory and resets when the server restarts.</div>}

      <div className="tabs" role="tablist">
        {TABS.filter((t) => owner || t === "Overview").map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {msg && <div className={`notice ${msg.ok ? "" : "notice-bad"}`} style={{ marginBottom: 16 }} role="status">{msg.text}</div>}

      {tab === "Overview" && (
        <div className="stack">
          <div className="card">
            <div className="spread">
              <div>
                <h3 style={{ marginBottom: 2 }}>Try-ons this period</h3>
                <p className="small muted" style={{ margin: 0 }}>Since {new Date(salon.periodStart).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}. Failed or rejected looks are refunded automatically.</p>
              </div>
              <div className="serif" style={{ fontSize: "1.6rem" }}>{salon.creditsUsed} <span className="muted" style={{ fontSize: "1rem" }}>/ {salon.creditsTotal}</span></div>
            </div>
            <div className="progress" style={{ marginTop: 14 }}><span style={{ width: `${pct}%`, background: pct > 85 ? "var(--warn)" : undefined }} /></div>
            <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>{left} try-ons left. Need more? Reply to your invoice email or contact Keshkala support.</p>
          </div>

          <div className="stats">
            <Stat n={props.usage30.sessions} l="Sessions (30 days)" />
            <Stat n={props.usage30.tryOns} l="Looks created (30 days)" />
            <Stat n={`${shareRate}%`} l="Sessions shared" />
            <Stat n={props.usage30.failed} l="Looks not shown (refunded)" />
          </div>

          <div className="grid-2">
            <div className="card">
              <h3>Your customer link</h3>
              <p className="small muted">Print the QR at reception or share the link on Instagram and WhatsApp. Customers try styles at home, then book.</p>
              <div className="row" style={{ alignItems: "flex-start" }}>
                <div style={{ width: 140, height: 140, background: "#fff", borderRadius: 12, padding: 8 }} dangerouslySetInnerHTML={{ __html: props.qrSvg }} />
                <div className="stack" style={{ flex: 1, minWidth: 180 }}>
                  <code className="small" style={{ wordBreak: "break-all" }}>{props.link}</code>
                  <div className="row">
                    <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(props.link).then(() => flash(true, "Link copied"))}>Copy link</button>
                    <a className="btn btn-ghost btn-sm" href={props.link} target="_blank" rel="noreferrer">Open</a>
                  </div>
                </div>
              </div>
            </div>
            <div className="card">
              <h3>Recent sessions</h3>
              <p className="small muted">Photos are never shown here and are deleted after 24 hours.</p>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>When</th><th>Where</th><th>Rounds</th><th>Data</th></tr></thead>
                  <tbody>
                    {props.recent.length === 0 && <tr><td colSpan={4} className="muted">No sessions yet.</td></tr>}
                    {props.recent.map((s) => (
                      <tr key={s.id}>
                        <td>{new Date(s.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td>
                        <td>{s.mode === "studio" ? "In salon" : "At home"}</td>
                        <td>{s.rounds}</td>
                        <td>{s.deleted ? <span className="badge">Deleted</span> : <span className="badge badge-ok">Live</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "Branding" && owner && <Branding salon={salon} plan={props.plan} onSave={save} onLogo={setSalon} flash={flash} />}
      {tab === "Styles" && owner && <Styles salon={salon} styles={props.styles} onSave={save} />}
      {tab === "Team" && owner && <Team salonId={salon.id} me={props.me} members={members} setMembers={setMembers} flash={flash} />}
    </main>
  );
}

function Stat({ n, l }: { n: number | string; l: string }) {
  return (
    <div className="card stat">
      <div className="num">{n}</div>
      <div className="lbl">{l}</div>
    </div>
  );
}

function Branding({ salon, plan, onSave, onLogo, flash }: {
  salon: Salon;
  plan: Plan;
  onSave: (p: Partial<Salon>) => Promise<void>;
  onLogo: (s: Salon) => void;
  flash: (ok: boolean, t: string) => void;
}) {
  const [name, setName] = useState(salon.name);
  const [booking, setBooking] = useState(salon.bookingUrl ?? "");
  const [wa, setWa] = useState(salon.whatsappNumber ?? "");
  const [city, setCity] = useState(salon.city ?? "");
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const { salon: s } = await api<{ salon: Salon }>(`/api/dashboard/${salon.id}/logo`, { method: "POST", body: file, headers: { "content-type": file.type } });
      onLogo(s);
      flash(true, "Logo updated");
    } catch (e) {
      flash(false, (e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid-2" style={{ alignItems: "start" }}>
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); void onSave({ name, bookingUrl: booking || null, whatsappNumber: wa.replace(/\D/g, "") || null, city: city || null }); }}>
        <h3>Salon details</h3>
        <label className="field"><span>Salon name (shown to customers)</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></label>
        <label className="field"><span>Booking link</span><input className="input" type="url" value={booking} onChange={(e) => setBooking(e.target.value)} placeholder="https://…" /></label>
        <label className="field"><span>Salon WhatsApp (with country code)</span><input className="input" inputMode="tel" value={wa} onChange={(e) => setWa(e.target.value)} placeholder="919812345678" /></label>
        <label className="field"><span>City</span><input className="input" value={city} onChange={(e) => setCity(e.target.value)} /></label>
        <button className="btn btn-accent">Save details</button>
      </form>

      <div className="card stack">
        <h3>Logo & colour</h3>
        {!plan.branding && <div className="notice notice-warn">Logo and colour branding are included in the Pro plan. Your boards use the Keshkala brass accent.</div>}
        <div className="row">
          <div style={{ width: 120, height: 72, borderRadius: 12, border: "1px solid var(--line)", display: "grid", placeItems: "center", background: "#fff", overflow: "hidden" }}>
            {salon.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={salon.logoUrl} alt="Logo" style={{ maxHeight: 60, maxWidth: 110, objectFit: "contain" }} />
            ) : <span className="small muted">No logo</span>}
          </div>
          <label className="btn btn-ghost btn-sm" aria-disabled={!plan.branding} style={{ opacity: plan.branding ? 1 : 0.5 }}>
            {uploading ? "Uploading…" : "Upload PNG or JPG"}
            <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={!plan.branding} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
          </label>
        </div>
        <div>
          <div className="small" style={{ fontWeight: 650, marginBottom: 8 }}>Accent colour</div>
          <div className="row">
            {SWATCHES.map((c) => (
              <button key={c} className="swatch" style={{ background: c }} aria-label={`Use ${c}`} aria-pressed={salon.accentColor === c} disabled={!plan.branding} onClick={() => onSave({ accentColor: c })} />
            ))}
            <input type="color" aria-label="Custom colour" value={salon.accentColor} disabled={!plan.branding} onChange={(e) => onSave({ accentColor: e.target.value })} style={{ width: 44, height: 44, border: 0, background: "none" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Styles({ salon, styles, onSave }: { salon: Salon; styles: StyleRow[]; onSave: (p: Partial<Salon>) => Promise<void> }) {
  const [disabled, setDisabled] = useState(new Set(salon.disabledStyleIds));
  const [gender, setGender] = useState<Gender>("women");
  const list = useMemo(() => styles.filter((s) => s.gender === gender), [styles, gender]);
  const dirty = [...disabled].sort().join() !== [...salon.disabledStyleIds].sort().join();

  const toggle = (id: string) => {
    const next = new Set(disabled);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDisabled(next);
  };

  return (
    <div className="stack">
      <div className="spread">
        <div className="segmented">
          {(["women", "men"] as Gender[]).map((g) => (
            <button key={g} className="chip" aria-pressed={gender === g} onClick={() => setGender(g)}>{g === "women" ? "Women" : "Men"}</button>
          ))}
        </div>
        <div className="row">
          <span className="small muted">{styles.length - disabled.size} of {styles.length} visible</span>
          <button className="btn btn-accent btn-sm" disabled={!dirty} onClick={() => onSave({ disabledStyleIds: [...disabled] })}>Save changes</button>
        </div>
      </div>
      <p className="small muted" style={{ margin: 0 }}>Untick the styles your team doesn't offer. Customers only see ticked styles.</p>
      <div className="toggle-list">
        {list.map((s) => (
          <label key={s.id} className="toggle-item">
            <StyleArt art={s.art} texture={s.textures[0]} title={s.name} />
            <span>
              <strong style={{ display: "block", fontSize: ".95rem" }}>{s.name}</strong>
              <span className="small muted">{s.length}{s.custom ? " · custom" : ""}</span>
            </span>
            <input type="checkbox" checked={!disabled.has(s.id)} onChange={() => toggle(s.id)} />
          </label>
        ))}
      </div>
    </div>
  );
}

function Team({ salonId, me, members, setMembers, flash }: {
  salonId: string;
  me: string;
  members: Member[];
  setMembers: (m: Member[]) => void;
  flash: (ok: boolean, t: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("staff");

  async function add() {
    try {
      const { member } = await api<{ member: Member }>(`/api/dashboard/${salonId}/members`, { method: "POST", json: { email, name, role } });
      setMembers([...members.filter((m) => m.id !== member.id), member]);
      setEmail("");
      setName("");
      flash(true, `${member.email} can now sign in with a magic link`);
    } catch (e) {
      flash(false, (e as Error).message);
    }
  }
  async function remove(m: Member) {
    if (!window.confirm(`Remove ${m.email}?`)) return;
    try {
      await api(`/api/dashboard/${salonId}/members?id=${m.id}`, { method: "DELETE" });
      setMembers(members.filter((x) => x.id !== m.id));
    } catch (e) {
      flash(false, (e as Error).message);
    }
  }

  return (
    <div className="grid-2" style={{ alignItems: "start" }}>
      <div className="card">
        <h3>Team</h3>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Person</th><th>Role</th><th /></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.name ?? "—"}</strong><div className="small muted">{m.email}</div></td>
                  <td>{m.role === "owner" ? "Owner" : "Stylist"}</td>
                  <td style={{ textAlign: "right" }}>{m.id !== me && <button className="btn btn-danger btn-sm" onClick={() => remove(m)}>Remove</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <h3>Add a team member</h3>
        <label className="field"><span>Email</span><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field"><span>Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span>Role</span>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="staff">Stylist: runs consultations</option>
            <option value="owner">Owner: also manages branding, styles and team</option>
          </select>
        </label>
        <button className="btn btn-accent">Add member</button>
      </form>
    </div>
  );
}
