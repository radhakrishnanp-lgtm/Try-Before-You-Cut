"use client";
import { useMemo, useState } from "react";
import { StyleArt } from "@/components/StyleArt";
import type { Gender, Length, Texture } from "@/lib/types";
import type { PublicStyle } from "./types";

const MAX = 4;
const LENGTHS: (Length | "all")[] = ["all", "short", "medium", "long"];
const TEXTURES: Texture[] = ["straight", "wavy", "curly"];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function StylePicker(props: {
  styles: PublicStyle[];
  gender: Gender;
  setGender: (g: Gender) => void;
  texture: Texture | null;
  setTexture: (t: Texture | null) => void;
  selected: string[];
  setSelected: (ids: string[]) => void;
  tried: Set<string>;
  busy: boolean;
  error: string | null;
  onGenerate: () => void;
  onBack: () => void;
  hasResults: boolean;
}) {
  const { styles, gender, setGender, texture, setTexture, selected, setSelected, tried } = props;
  const [length, setLength] = useState<Length | "all">("all");
  const [suitedOnly, setSuitedOnly] = useState(true);

  const visible = useMemo(
    () =>
      styles.filter(
        (s) => s.gender === gender && (length === "all" || s.length === length) && (!texture || !suitedOnly || s.textures.includes(texture)),
      ),
    [styles, gender, length, texture, suitedOnly],
  );

  function toggle(id: string) {
    if (selected.includes(id)) setSelected(selected.filter((s) => s !== id));
    else if (selected.length < MAX) setSelected([...selected, id]);
  }

  return (
    <div className="container flow">
      <div className="flow-head spread">
        <div>
          <div className="eyebrow">Step 2 of 3</div>
          <h1 style={{ marginBottom: 4 }}>Choose up to four looks</h1>
          <p className="muted" style={{ margin: 0 }}>We'll create them at the same time. You can always try more afterwards.</p>
        </div>
        {props.hasResults && <button className="btn btn-ghost btn-sm" onClick={props.onBack}>Back to my looks</button>}
      </div>

      <div className="filters">
        <div className="segmented" role="group" aria-label="Catalogue">
          {(["women", "men"] as Gender[]).map((g) => (
            <button key={g} className="chip" aria-pressed={gender === g} onClick={() => { setGender(g); setSelected([]); }}>
              {g === "women" ? "Women" : "Men"}
            </button>
          ))}
        </div>
      </div>
      <div className="filters">
        <span className="filter-label">Length</span>
        {LENGTHS.map((l) => (
          <button key={l} className="chip" aria-pressed={length === l} onClick={() => setLength(l)}>{l === "all" ? "All" : cap(l)}</button>
        ))}
      </div>
      <div className="filters">
        <span className="filter-label">My hair</span>
        {TEXTURES.map((t) => (
          <button key={t} className="chip" aria-pressed={texture === t} onClick={() => setTexture(texture === t ? null : t)}>{cap(t)}</button>
        ))}
        {texture && (
          <label className="small" style={{ display: "inline-flex", gap: 8, alignItems: "center", marginLeft: 6 }}>
            <input type="checkbox" checked={suitedOnly} onChange={(e) => setSuitedOnly(e.target.checked)} /> Only styles that suit {texture} hair
          </label>
        )}
      </div>

      <div className="style-grid">
        {visible.map((s) => {
          const on = selected.includes(s.id);
          return (
            <button key={s.id} className="style-card" aria-pressed={on} onClick={() => toggle(s.id)} disabled={!on && selected.length >= MAX}>
              <div className="style-art">
                {s.referenceImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.referenceImageUrl} alt="" />
                ) : (
                  <StyleArt art={s.art} texture={s.textures.length === 1 ? s.textures[0] : texture && s.textures.includes(texture) ? texture : s.textures[0]} title={s.name} />
                )}
              </div>
              <span className="style-check" aria-hidden>{on ? selected.indexOf(s.id) + 1 : "+"}</span>
              <div className="style-meta">
                <h3>{s.name}</h3>
                <p>{s.description}</p>
                {tried.has(s.id) && <span className="badge" style={{ marginTop: 8 }}>Tried</span>}
              </div>
            </button>
          );
        })}
        {visible.length === 0 && <p className="muted">No styles match these filters.</p>}
      </div>

      <div className="sticky-cta">
        <div className="container spread">
          <div>
            <strong>{selected.length} of {MAX} selected</strong>
            {props.error && <div className="small" style={{ color: "var(--bad)" }} role="alert">{props.error}</div>}
          </div>
          <div className="row">
            {selected.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setSelected([])}>Clear</button>}
            <button className="btn btn-accent" disabled={selected.length === 0 || props.busy} onClick={props.onGenerate}>
              {props.busy ? "Starting…" : selected.length > 1 ? `Try ${selected.length} looks` : "Try this look"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
