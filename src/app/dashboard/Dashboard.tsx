"use client";
import { useMemo, useState } from "react";
import { StyleArt } from "@/components/StyleArt";
import { Tilt } from "@/components/fx/Tilt";
import { api } from "@/lib/client/api";
import type { UsageStats } from "@/lib/store/types";
import type { Gender, Length, Member, Role, Salon, StyleArt as Art, Texture } from "@/lib/types";

interface StyleRow { id: string; name: string; gender: Gender; length: Length; art: Art; textures: Texture[]; custom: boolean }
interface SessionRow { id: string; mode: "studio" | "remote"; createdAt: string; rounds: number; deleted: boolean }

const TABS = ["Overview", "Branding", "Styles", "Team"] as const;
const SWATCHES = ["#d6ab63", "#c7866a", "#b4566a", "#6fae95", "#6f8fd0", "#9b7fd0", "#e8e1d6"];

export function Dashboard(props: {
  salon: Salon;
  role: Role;
  me: string | null;
  members: Member[];
  styles: StyleRow[];
  usage30: UsageStats;
  recent: SessionRow[];
  link: string;
  qrSvg: string;
  creditsPerImage: number;
  studioHref: string;
  demo: boolean;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [salon, setSalon] = useState(props.salon);
  const [members, setMembers] = useState(props.members);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const owner = props.role === "owner";
  const cpi = props.creditsPerImage;

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

  const balance = Math.max(0, salon.creditsTotal - salon.creditsUsed);
  const photosLeft = Math.floor(balance / cpi);
  const pctLeft = salon.creditsTotal ? Math.min(100, (balance / salon.creditsTotal) * 100) : 0;
  const shareRate = props.usage30.sessions ? Math.round((props.usage30.sharedSessions / props.usage30.sessions) * 100) : 0;

  return (
    <main className="container flow" style={{ ["--accent" as string]: salon.accentColor }}>
      <div className="spread enter" style={{ marginBottom: 18 }}>
        <div>
          <div className="eyebrow">{owner ? "Owner" : "Stylist"} dashboard</div>
          <h1 style={{ marginBottom: 0 }}>{salon.name}</h1>
        </div>
        <a className="btn btn-accent" href={props.studioHref}>Start a consultation →</a>
      </div>
      {props.demo && <div className="notice notice-warn" style={{ marginBottom: 16 }}>Demo mode: data lives in memory and resets when the server restarts.</div>}

      <div className="tabs" role="tablist">
        {TABS.filter((t) => owner || t === "Overview").map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {msg && <div className={`notice ${msg.ok ? "" : "notice-bad"}`} style={{ marginBottom: 16 }} role="status">{msg.text}</div>}

      {tab === "Overview" && (
        <div className="stack">
          <Tilt className="card panel-dark" max={3}>
            <div className="spread depth-1">
              <div>
                <div className="eyebrow">Credit balance</div>
                <div className="serif" style={{ fontSize: "3.2rem", lineHeight: 1 }}>
                  <span className="text-gold" style={{ fontStyle: "normal" }}>{photosLeft.toLocaleString("en-IN")}</span>
                  <span className="muted" style={{ fontSize: "1.2rem" }}> looks left</span>
                </div>
                <p className="small muted" style={{ margin: "8px 0 0" }}>
                  {balance.toLocaleString("en-IN")} credits · {cpi} credits per look · {salon.creditsUsed.toLocaleString("en-IN")} used of {salon.creditsTotal.toLocaleString("en-IN")}
                </p>
              </div>
              <div style={{ minWidth: 240, flex: "0 1 360px" }}>
                <div className="meter"><span style={{ width: `${pctLeft}%` }} /></div>
                <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
                  {photosLeft < 10 ? "Running low. Contact Try-Before-You-Cut support to top up." : "Looks that fail the quality check are refunded automatically."}
                </p>
              </div>
            </div>
          </Tilt>

          <div className="stats">
            <Stat n={props.usage30.sessions} l="Consultations (30 days)" />
            <Stat n={props.usage30.tryOns} l="Looks created (30 days)" />
            <Stat n={`${shareRate}%`} l="Shared to customers" />
            <Stat n={props.usage30.failed} l="Looks refunded" />
          </div>

          <div className="grid-2">
            <Tilt className="card" max={4}>
              <h3 className="depth-1">Your customer link</h3>
              <p className="small muted depth-1">Print the QR at reception or share it on Instagram and WhatsApp. Customers try looks at home, then book.</p>
              <div className="row depth-2" style={{ alignItems: "flex-start" }}>
                <div style={{ width: 150, height: 150, background: "#f4eee5", borderRadius: 16, padding: 10, boxShadow: "0 20px 40px -20px rgba(0,0,0,.9)" }} dangerouslySetInnerHTML={{ __html: props.qrSvg }} />
                <div className="stack" style={{ flex: 1, minWidth: 180 }}>
                  <code className="small" style={{ wordBreak: "break-all" }}>{props.link}</code>
                  <div className="row">
                    <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(props.link).then(() => flash(true, "Link copied"))}>Copy link</button>
                    <a className="btn btn-ghost btn-sm" href={props.link} target="_blank" rel="noreferrer">Open</a>
                  </div>
                </div>
              </div>
            </Tilt>
            <div className="card">
              <h3>Recent consultations</h3>
              <p className="small muted">Photos are never shown here and are deleted after 24 hours.</p>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>When</th><th>Where</th><th>Rounds</th><th>Data</th></tr></thead>
                  <tbody>
                    {props.recent.length === 0 && <tr><td colSpan={4} className="muted">No consultations yet.</td></tr>}
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

      {tab === "Branding" && owner && <Branding salon={salon} onSave={save} onLogo={setSalon} flash={flash} />}
      {tab === "Styles" && owner && <Styles salon={salon} styles={props.styles} onSave={save} />}
      {tab === "Team" && owner && <Team salonId={salon.id} me={props.me} members={members} setMembers={setMembers} flash={flash} />}
    </main>
  );
}

function Stat({ n, l }: { n: number | string; l: string }) {
  return (
    <Tilt className="card stat" max={10}>
      <div className="num depth-2">{n}</div>
      <div className="lbl depth-1">{l}</div>
    </Tilt>
  );
}

function Branding({ salon, onSave, onLogo, flash }: {
  salon: Salon;
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
        <button className="btn">Save details</button>
      </form>

      <div className="card stack">
        <h3>Logo & colour</h3>
        <p className="small muted" style={{ margin: 0 }}>Shown on the customer screens, downloads and every Stylist Board.</p>
        <div className="row">
          <div style={{ width: 130, height: 76, borderRadius: 14, border: "1px solid var(--line)", display: "grid", placeItems: "center", background: "rgba(0,0,0,.3)", overflow: "hidden" }}>
            {salon.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={salon.logoUrl} alt="Logo" style={{ maxHeight: 62, maxWidth: 118, objectFit: "contain" }} />
            ) : <span className="small muted">No logo</span>}
          </div>
          <label className="btn btn-ghost btn-sm">
            {uploading ? "Uploading…" : "Upload PNG or JPG"}
            <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
          </label>
        </div>
        <div>
          <div className="small" style={{ fontWeight: 700, marginBottom: 10, color: "var(--muted)" }}>Accent colour</div>
          <div className="row">
            {SWATCHES.map((c) => (
              <button key={c} className="swatch" style={{ background: c }} aria-label={`Use ${c}`} aria-pressed={salon.accentColor === c} onClick={() => onSave({ accentColor: c })} />
            ))}
            <input type="color" aria-label="Custom colour" value={salon.accentColor} onChange={(e) => onSave({ accentColor: e.target.value })} style={{ width: 44, height: 44, border: 0, background: "none" }} />
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
          <button className="btn btn-sm" disabled={!dirty} onClick={() => onSave({ disabledStyleIds: [...disabled] })}>Save changes</button>
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
  me: string | null;
  members: Member[];
  setMembers: (m: Member[]) => void;
  flash: (ok: boolean, t: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("staff");

  async function add() {
    try {
      const { member } = await api<{ member: Member }>(`/api/dashboard/${salonId}/members`, { method: "POST", json: { username, password, name, role } });
      setMembers([...members, member]);
      setUsername("");
      setPassword("");
      setName("");
      flash(true, `${member.username} can now sign in. Share the password with them privately.`);
    } catch (e) {
      flash(false, (e as Error).message);
    }
  }
  async function reset(m: Member) {
    const pw = window.prompt(`New password for ${m.username} (at least 8 characters):`);
    if (!pw) return;
    try {
      await api(`/api/dashboard/${salonId}/members`, { method: "PATCH", json: { memberId: m.id, password: pw } });
      flash(true, `Password changed for ${m.username}. They'll need to sign in again.`);
    } catch (e) {
      flash(false, (e as Error).message);
    }
  }
  async function remove(m: Member) {
    if (!window.confirm(`Remove ${m.username}? They will no longer be able to sign in.`)) return;
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
        <h3>Team logins</h3>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Person</th><th>Role</th><th /></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.name ?? m.username}</strong><div className="small muted">@{m.username}</div></td>
                  <td>{m.role === "owner" ? "Owner" : "Stylist"}</td>
                  <td style={{ textAlign: "right" }}>
                    <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => reset(m)}>Password</button>
                      {m.id !== me && <button className="btn btn-danger btn-sm" onClick={() => remove(m)}>Remove</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <h3>Add a login</h3>
        <label className="field"><span>Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ravi" /></label>
        <label className="field"><span>Username</span><input className="input" required autoCapitalize="none" pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{2,39}" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ravi.amara" /></label>
        <label className="field"><span>Password (min 8 characters)</span><input className="input" required minLength={8} type="text" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label className="field"><span>Role</span>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="staff">Stylist: runs consultations</option>
            <option value="owner">Owner: also manages branding, styles and team</option>
          </select>
        </label>
        <button className="btn">Create login</button>
      </form>
    </div>
  );
}
