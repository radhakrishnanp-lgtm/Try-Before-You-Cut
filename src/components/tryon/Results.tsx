"use client";
import { Tilt } from "@/components/fx/Tilt";
import { AI_DISCLAIMER } from "@/lib/copy";
import type { PublicStyle, ResultView, SessionView } from "./types";

export function Results({ view, styles, chosen, onToggleChosen, onOpen, onMore, onBoard, demo }: {
  view: SessionView;
  styles: Map<string, PublicStyle>;
  chosen: string[];
  onToggleChosen: (id: string) => void;
  onOpen: (id: string) => void;
  onMore: () => void;
  onBoard: () => void;
  demo: boolean;
}) {
  const results = [...view.results].reverse();
  const done = results.filter((r) => r.status === "ready" || r.status === "failed").length;
  const pending = results.length - done;
  const ready = results.filter((r) => r.status === "ready");

  return (
    <div className="container flow">
      <div className="flow-head spread">
        <div>
          <div className="eyebrow">Step 3 of 3</div>
          <h1 style={{ marginBottom: 4 }}>{pending > 0 ? <>Creating your <em>looks</em>…</> : <>Your <em>looks</em></>}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {pending > 0 ? `${pending} still styling. Each appears as soon as it's ready.` : "Tap a look to compare it with your photo. Tap ♡ to shortlist for your Stylist Board."}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={onMore}>Try more styles</button>
      </div>
      {pending > 0 && (
        <div className="progress" style={{ marginBottom: 20 }} aria-hidden>
          <span style={{ width: `${(done / Math.max(1, results.length)) * 100}%` }} />
        </div>
      )}
      {demo && (
        <div className="notice notice-warn" style={{ marginBottom: 20 }}>
          Demo mode: no AI provider is configured, so previews show your original photo. Add a Gemini or Replicate key to generate real looks.
        </div>
      )}

      <div className="result-grid">
        {results.map((r) => (
          <ResultCard key={r.id} r={r} style={styles.get(r.styleId)} photo={view.photoUrl} chosen={chosen.includes(r.id)} onToggle={() => onToggleChosen(r.id)} onOpen={() => onOpen(r.id)} />
        ))}
      </div>
      <p className="disclaimer">{AI_DISCLAIMER}</p>

      {ready.length > 0 && (
        <div className="sticky-cta">
          <div className="container spread">
            <span><strong>{chosen.length}</strong> shortlisted</span>
            <button className="btn btn-accent" onClick={onBoard}>
              {chosen.length ? "Create Stylist Board" : "Share & download"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultCard({ r, style, photo, chosen, onToggle, onOpen }: {
  r: ResultView;
  style?: PublicStyle;
  photo: string | null;
  chosen: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const name = style?.name ?? "Look";
  return (
    <Tilt className="result-card" max={r.status === "ready" ? 8 : 3}>
      {r.status === "ready" && (
        <button className="heart" aria-pressed={chosen} aria-label={chosen ? `Remove ${name} from board` : `Add ${name} to board`} onClick={onToggle}>
          {chosen ? "♥" : "♡"}
        </button>
      )}
      <button className="result-media" style={{ display: "block", width: "100%", border: 0, padding: 0, cursor: r.status === "ready" ? "pointer" : "default" }} disabled={r.status !== "ready"} onClick={onOpen} aria-label={`Compare ${name}`}>
        {r.status === "ready" && r.imageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.imageUrl} alt={`You with a ${name}`} />
            <span className="ai-tag">AI preview</span>
          </>
        )}
        {(r.status === "pending" || r.status === "running") && (
          <div className="result-pending">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo && <img className="ghost" src={photo} alt="" />}
            <div>
              <div className="spinner" />
              <div className="small"><strong>Styling</strong><br />{name}</div>
            </div>
          </div>
        )}
        {r.status === "failed" && (
          <div className="result-failed">
            <div>
              <span className="badge badge-bad" style={{ marginBottom: 8 }}>Not shown</span>
              <div>{r.error ?? "We couldn't create this look."}</div>
            </div>
          </div>
        )}
      </button>
      <div className="result-meta">
        <h3>{name}</h3>
        {r.status === "ready" && r.similarity !== null && r.provider !== "mock" && <span className="badge badge-ok" title="Identity check passed">Likeness ✓</span>}
      </div>
    </Tilt>
  );
}
