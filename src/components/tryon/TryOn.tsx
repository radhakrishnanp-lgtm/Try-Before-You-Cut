"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "@/lib/client/api";
import { downloadBlob, shareFile, watermarked } from "@/lib/client/canvas";
import { preloadDetector } from "@/lib/client/quality";
import { AI_DISCLAIMER } from "@/lib/copy";
import type { Gender, Texture } from "@/lib/types";
import { BeforeAfter } from "./Compare";
import { Capture } from "./Capture";
import { Consent } from "./Consent";
import { Results } from "./Results";
import { SharePanel } from "./SharePanel";
import { StylePicker } from "./StylePicker";
import type { PublicSalon, PublicStyle, ResultView, SessionView, Step } from "./types";

interface Stored {
  sessionId: string;
  token: string;
}

export function TryOn({ salon, styles, mode, staffName }: {
  salon: PublicSalon;
  styles: PublicStyle[];
  mode: "studio" | "remote";
  staffName?: string | null;
}) {
  const storageKey = `kk:${salon.slug}:${mode}`;
  const [step, setStep] = useState<Step>("consent");
  const [auth, setAuth] = useState<Stored | null>(null);
  const [view, setView] = useState<SessionView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gender, setGender] = useState<Gender>("women");
  const [texture, setTexture] = useState<Texture | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const chosenSave = useRef<Promise<unknown>>(Promise.resolve());

  const styleMap = useMemo(() => new Map(styles.map((s) => [s.id, s])), [styles]);
  const token = auth?.token ?? null;

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3500);
  }, []);

  const forget = useCallback(() => {
    try { sessionStorage.removeItem(storageKey); } catch { /* private mode */ }
    setAuth(null);
    setView(null);
    setSelected([]);
    setChosen([]);
    setCompareId(null);
  }, [storageKey]);

  // Restore an in-progress session after a refresh (same tab only).
  useEffect(() => {
    preloadDetector();
    let saved: Stored | null = null;
    try { saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null"); } catch { /* ignore */ }
    if (!saved) { setRestoring(false); return; }
    api<SessionView>(`/api/sessions/${saved.sessionId}`, { token: saved.token })
      .then((v) => {
        setAuth(saved);
        setView(v);
        setChosen(v.chosenResultIds);
        setStep(!v.photoUrl ? "capture" : v.results.length ? "results" : "styles");
        // Resume anything that was still generating.
        v.results.filter((r) => r.status === "pending").forEach((r) => void run(saved!, r.id));
      })
      .catch(() => forget())
      .finally(() => setRestoring(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);

  const patchResult = (r: Partial<ResultView> & { id: string }) =>
    setView((v) => (v ? { ...v, results: v.results.map((x) => (x.id === r.id ? { ...x, ...r } : x)) } : v));

  async function run(a: Stored, resultId: string) {
    try {
      const r = await api<ResultView>(`/api/results/${resultId}/run`, { method: "POST", token: a.token, json: { texture } });
      patchResult(r);
    } catch (e) {
      patchResult({ id: resultId, status: "failed", error: (e as Error).message });
    }
  }

  async function accept(v: { isMinor: boolean; guardianConsent: boolean }) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ sessionId: string; token: string }>("/api/sessions", {
        method: "POST",
        json: { salonSlug: salon.slug, mode, consent: true, ...v },
      });
      const a = { sessionId: res.sessionId, token: res.token };
      try { sessionStorage.setItem(storageKey, JSON.stringify(a)); } catch { /* private mode */ }
      setAuth(a);
      setStep("capture");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function upload(photo: Blob) {
    if (!auth) return;
    setBusy(true);
    setError(null);
    try {
      const v = await api<SessionView>(`/api/sessions/${auth.sessionId}/photo`, {
        method: "POST", token: auth.token, body: photo, headers: { "content-type": photo.type },
      });
      setView(v);
      setChosen([]);
      setStep("styles");
    } catch (e) {
      if (e instanceof ApiError && e.status === 410) { forget(); setStep("consent"); }
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!auth || !view) return;
    setBusy(true);
    setError(null);
    try {
      const { results } = await api<{ results: { id: string; styleId: string; status: ResultView["status"] }[] }>(
        `/api/sessions/${auth.sessionId}/rounds`, { method: "POST", token: auth.token, json: { styleIds: selected } },
      );
      const fresh: ResultView[] = results.map((r) => ({ ...r, error: null, similarity: null, provider: null, imageUrl: null }));
      setView({ ...view, rounds: view.rounds + 1, results: [...view.results, ...fresh] });
      setSelected([]);
      setStep("results");
      // Fire all generations in parallel; each card updates as it lands.
      fresh.forEach((r) => void run(auth, r.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleChosen(id: string) {
    if (!auth) return;
    const next = chosen.includes(id) ? chosen.filter((c) => c !== id) : chosen.length >= 4 ? chosen : [...chosen, id];
    if (next === chosen) { toast("A board holds up to four looks"); return; }
    setChosen(next);
    // Serialise saves so quick taps can't land out of order.
    chosenSave.current = chosenSave.current
      .then(() => api(`/api/sessions/${auth.sessionId}`, { method: "PATCH", token: auth.token, json: { chosenResultIds: next } }))
      .catch(() => undefined);
  }

  async function deleteData() {
    if (!auth) { setStep("deleted"); return; }
    if (!window.confirm("Delete your photo and all previews now? This can't be undone.")) return;
    try {
      await api(`/api/sessions/${auth.sessionId}`, { method: "DELETE", token: auth.token });
      forget();
      setStep("deleted");
    } catch (e) {
      toast((e as Error).message);
    }
  }

  function newCustomer() {
    if (auth && !window.confirm("Start a new customer? This customer's previews stay available to them for 24 hours via any link you shared.")) return;
    forget();
    setStep("consent");
  }

  const tried = useMemo(() => new Set(view?.results.map((r) => r.styleId) ?? []), [view]);
  const compare = view?.results.find((r) => r.id === compareId && r.imageUrl);
  const hoursLeft = view ? Math.max(0, Math.round((new Date(view.expiresAt).getTime() - Date.now()) / 3600_000)) : null;

  return (
    <div style={{ ["--accent" as string]: salon.accentColor }}>
      <header className="topbar">
        <div className="container topbar-inner">
          <a className="brand" href={mode === "studio" ? "/studio" : `/t/${salon.slug}`}>
            {salon.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="brand-logo" src={salon.logoUrl} alt={salon.name} />
            ) : (
              <span className="brand-mark" aria-hidden>{salon.name[0]}</span>
            )}
            <span className="brand-name">{salon.name}</span>
          </a>
          <div className="row">
            {step !== "consent" && step !== "deleted" && (
              <div className="steps" aria-hidden>
                {(["capture", "styles", "results"] as Step[]).map((s, i) => (
                  <span key={s} className={["capture", "styles", "results", "compare", "share"].indexOf(step) >= i ? "on" : ""} />
                ))}
              </div>
            )}
            {mode === "studio" && (
              <>
                {staffName && <span className="small muted">{staffName}</span>}
                <button className="btn btn-ghost btn-sm" onClick={newCustomer}>New customer</button>
              </>
            )}
          </div>
        </div>
      </header>

      {restoring ? (
        <div className="center flow"><div className="spinner" /></div>
      ) : (
        <main>
          {step === "consent" && <Consent salon={salon} mode={mode} busy={busy} onAccept={accept} />}
          {step === "capture" && <Capture busy={busy} serverError={error} onSubmit={upload} />}
          {step === "styles" && (
            <StylePicker
              styles={styles} gender={gender} setGender={setGender} texture={texture} setTexture={setTexture}
              selected={selected} setSelected={setSelected} tried={tried} busy={busy} error={error}
              onGenerate={generate} onBack={() => setStep("results")} hasResults={Boolean(view?.results.length)}
            />
          )}
          {step === "results" && view && (
            <Results
              view={view} styles={styleMap} chosen={chosen} onToggleChosen={toggleChosen}
              onOpen={(id) => { setCompareId(id); setStep("compare"); }}
              onMore={() => { setError(null); setStep("styles"); }} onBoard={() => setStep("share")} demo={view.demo.ai}
            />
          )}
          {step === "compare" && view && compare && view.photoUrl && (
            <CompareStep
              salon={salon} result={compare} style={styleMap.get(compare.styleId)} photoUrl={view.photoUrl}
              chosen={chosen.includes(compare.id)} onToggle={() => toggleChosen(compare.id)}
              onBack={() => setStep("results")} onBoard={() => setStep("share")} toast={toast}
              logShare={(channel) => auth && api(`/api/sessions/${auth.sessionId}/share`, { method: "POST", token: auth.token, json: { channel } }).catch(() => undefined)}
            />
          )}
          {step === "share" && view && (
            <SharePanel salon={salon} view={view} styles={styleMap} chosen={chosen} mode={mode} token={token}
              onNoteSaved={setView} onBack={() => setStep("results")} toast={toast} />
          )}
          {step === "deleted" && (
            <div className="narrow flow center enter" style={{ paddingBottom: 30 }}>
              <h1>Your data has been <em>deleted</em></h1>
              <p className="muted">Your photo and every preview were erased from our servers, and your consent was withdrawn.</p>
              <button className="btn btn-accent" onClick={() => setStep("consent")}>Start again</button>
            </div>
          )}
          <footer className="container small muted" style={{ paddingBottom: 120, textAlign: "center" }}>
            {step !== "consent" && step !== "deleted" && (
              <p style={{ marginBottom: 8 }}>
                {hoursLeft !== null && <>Your photo and previews are deleted automatically in about {hoursLeft} hours. </>}
                <button className="btn-link" onClick={deleteData}>Delete my data now</button>
                {" · "}<a href="/privacy">Privacy</a>
              </p>
            )}
            <span style={{ color: "var(--faint)" }}>Powered by <a href="/">Try-Before-You-Cut</a></span>
          </footer>
        </main>
      )}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}

function CompareStep({ salon, result, style, photoUrl, chosen, onToggle, onBack, onBoard, toast, logShare }: {
  salon: PublicSalon;
  result: ResultView;
  style?: PublicStyle;
  photoUrl: string;
  chosen: boolean;
  onToggle: () => void;
  onBack: () => void;
  onBoard: () => void;
  toast: (m: string) => void;
  logShare: (channel: "download" | "native") => void;
}) {
  const name = style?.name ?? "Look";
  async function file() {
    return watermarked(result.imageUrl!, salon, name);
  }
  return (
    <div className="container flow">
      <div className="flow-head spread">
        <div>
          <div className="eyebrow">Before & after</div>
          <h1 style={{ marginBottom: 4 }}>{name}</h1>
          {style && <p className="muted" style={{ margin: 0 }}>{style.description}</p>}
        </div>
        <button className="btn btn-ghost" onClick={onBack}>All looks</button>
      </div>
      <BeforeAfter before={photoUrl} after={result.imageUrl!} alt={`You with a ${name}`} />
      <p className="disclaimer">{AI_DISCLAIMER}</p>
      <div className="row" style={{ justifyContent: "center", marginTop: 16 }}>
        <button className="btn btn-ghost" aria-pressed={chosen} onClick={onToggle}>{chosen ? "♥ On my board" : "♡ Add to board"}</button>
        <button className="btn btn-ghost" onClick={async () => {
          try { downloadBlob(await file(), `${salon.slug}-${style?.id ?? "look"}.jpg`); logShare("download"); } catch { toast("Download failed. Please try again."); }
        }}>Download</button>
        <button className="btn btn-ghost" onClick={async () => {
          try {
            const ok = await shareFile(await file(), `${salon.slug}-${style?.id ?? "look"}.jpg`, `My ${name} preview from ${salon.name}`);
            if (ok) logShare("native"); else onBoard();
          } catch { toast("Sharing failed. Please try again."); }
        }}>Share</button>
        <button className="btn btn-accent" onClick={onBoard}>Stylist Board</button>
      </div>
    </div>
  );
}
