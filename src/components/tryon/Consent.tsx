"use client";
import { useState } from "react";
import { consentPoints } from "@/lib/legal";
import type { PublicSalon } from "./types";

export function Consent({ salon, mode, busy, onAccept }: {
  salon: PublicSalon;
  mode: "studio" | "remote";
  busy: boolean;
  onAccept: (v: { isMinor: boolean; guardianConsent: boolean }) => void;
}) {
  const [agree, setAgree] = useState(false);
  const [isMinor, setIsMinor] = useState(false);
  const [guardian, setGuardian] = useState(false);
  const ok = agree && (!isMinor || guardian);

  return (
    <div className="narrow flow">
      <div className="eyebrow">{mode === "studio" ? "In-salon consultation" : `Welcome to ${salon.name}`}</div>
      <h1>See your next haircut on you, before a single snip.</h1>
      <p className="muted" style={{ fontSize: "1.1rem" }}>
        Take one photo, pick up to four styles and compare realistic previews side by side with your stylist.
      </p>

      <div className="card" style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: "1.35rem" }}>Before we take your photo</h2>
        <ul className="consent-list">
          {consentPoints(salon.name).map((p) => (
            <li key={p.title}>
              <strong>{p.title}</strong>
              <span>{p.body}</span>
            </li>
          ))}
        </ul>
        <label className="check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>I agree to {salon.name} and Keshkala using my photo only for this hairstyle preview, as described above.</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={isMinor} onChange={(e) => setIsMinor(e.target.checked)} />
          <span>The person in the photo is under 18.</span>
        </label>
        {isMinor && (
          <label className="check" style={{ paddingLeft: 36 }}>
            <input type="checkbox" checked={guardian} onChange={(e) => setGuardian(e.target.checked)} />
            <span>I am their parent or legal guardian and I give consent on their behalf.</span>
          </label>
        )}
        <button className="btn btn-accent btn-block" style={{ marginTop: 12 }} disabled={!ok || busy} onClick={() => onAccept({ isMinor, guardianConsent: guardian })}>
          {busy ? "Starting…" : "I agree, continue"}
        </button>
        <p className="small muted center" style={{ marginTop: 12, marginBottom: 0 }}>
          You can withdraw consent and delete everything at any time. <a href="/privacy">Privacy policy</a>
        </p>
      </div>
    </div>
  );
}
