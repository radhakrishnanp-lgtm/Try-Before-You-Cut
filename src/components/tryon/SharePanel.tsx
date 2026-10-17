"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client/api";
import { downloadBlob, shareFile, stylistBoard } from "@/lib/client/canvas";
import { AI_DISCLAIMER } from "@/lib/copy";
import type { PublicSalon, PublicStyle, SessionView } from "./types";

type Channel = "whatsapp" | "native" | "download" | "board" | "link";

export function SharePanel({ salon, view, styles, chosen, mode, token, onNoteSaved, onBack, toast }: {
  salon: PublicSalon;
  view: SessionView;
  styles: Map<string, PublicStyle>;
  chosen: string[];
  mode: "studio" | "remote";
  token: string | null;
  onNoteSaved: (v: SessionView) => void;
  onBack: () => void;
  toast: (msg: string) => void;
}) {
  const [note, setNote] = useState(view.stylistNote ?? "");
  const [phone, setPhone] = useState("");
  const [board, setBoard] = useState<Blob | null>(null);
  const [boardUrl, setBoardUrl] = useState<string | null>(null);
  const [building, setBuilding] = useState(true);

  const items = useMemo(() => {
    const ready = view.results.filter((r) => r.status === "ready" && r.imageUrl);
    const picked = chosen.length ? ready.filter((r) => chosen.includes(r.id)) : ready.slice(-4);
    return picked.slice(0, 4).map((r) => ({ url: r.imageUrl!, name: styles.get(r.styleId)?.name ?? "Look" }));
  }, [view.results, chosen, styles]);

  const savedNote = view.stylistNote ?? "";
  useEffect(() => {
    let cancelled = false;
    setBuilding(true);
    stylistBoard({ brand: salon, before: view.photoUrl, items, note: savedNote || null })
      .then((b) => {
        if (cancelled) return;
        setBoard(b);
        setBoardUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(b);
        });
      })
      .catch(() => toast("Couldn't build the board image. You can still share the link."))
      .finally(() => !cancelled && setBuilding(false));
    return () => {
      cancelled = true;
    };
  }, [salon, view.photoUrl, items, savedNote, toast]);

  async function shareLink(channel: Channel): Promise<string> {
    const { shareUrl } = await api<{ shareUrl: string }>(`/api/sessions/${view.id}/share`, { method: "POST", token, json: { channel } });
    return shareUrl;
  }

  const message = (url: string) =>
    `Your hairstyle previews from ${salon.name} ✂️\n${items.map((i) => `• ${i.name}`).join("\n")}\n\nSee them here (link expires in 24 hours): ${url}` +
    (salon.bookingUrl ? `\nBook: ${salon.bookingUrl}` : "");

  async function saveNote() {
    if (note === savedNote) return;
    try {
      onNoteSaved(await api<SessionView>(`/api/sessions/${view.id}`, { method: "PATCH", token, json: { stylistNote: note } }));
      toast("Note added to the board");
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function whatsapp() {
    const digits = phone.replace(/\D/g, "");
    if (mode === "studio" && digits.length !== 10 && !(digits.length === 12 && digits.startsWith("91"))) {
      toast("Enter the customer's 10-digit mobile number");
      return;
    }
    // Open the window synchronously so popup blockers allow it.
    const win = window.open("about:blank", "_blank");
    try {
      const url = await shareLink("whatsapp");
      const to = digits ? (digits.length === 10 ? `91${digits}` : digits) : "";
      const wa = `https://wa.me/${to}?text=${encodeURIComponent(message(url))}`;
      if (win) win.location.href = wa;
      else window.location.href = wa;
    } catch (e) {
      win?.close();
      toast((e as Error).message);
    }
  }

  async function nativeShare() {
    if (!board) return;
    try {
      const url = await shareLink("native");
      const ok = await shareFile(board, `${salon.slug}-stylist-board.jpg`, message(url));
      if (!ok) {
        await navigator.clipboard?.writeText(url);
        toast("Sharing isn't supported here, so we copied the link instead");
      }
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function download() {
    if (!board) return;
    downloadBlob(board, `${salon.slug}-stylist-board.jpg`);
    void shareLink("download").catch(() => undefined);
  }

  async function copyLink() {
    try {
      const url = await shareLink("link");
      await navigator.clipboard.writeText(url);
      toast("Link copied. It works for 24 hours.");
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <div className="container flow">
      <div className="flow-head spread">
        <div>
          <div className="eyebrow">Stylist Board</div>
          <h1 style={{ marginBottom: 4 }}>Take your looks with you</h1>
          <p className="muted" style={{ margin: 0 }}>
            {chosen.length ? `${items.length} shortlisted look${items.length === 1 ? "" : "s"}` : "Showing your latest looks. Tap ♡ on the results to choose."}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={onBack}>Back to looks</button>
      </div>

      <div className="hero-grid" style={{ alignItems: "start", gap: 28 }}>
        <div className="card" style={{ padding: 12 }}>
          {boardUrl && !building ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={boardUrl} alt="Your Stylist Board" style={{ borderRadius: 12, width: "100%" }} />
          ) : (
            <div className="center" style={{ padding: 80 }}><div className="spinner" />Building your board…</div>
          )}
        </div>

        <div className="stack">
          {mode === "studio" && (
            <div className="card stack">
              <label className="field">
                <span>Stylist's note (appears on the board)</span>
                <textarea className="input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote}
                  placeholder="e.g. Butterfly cut, keep length below shoulders. Light layers around the face." />
              </label>
              <button className="btn btn-ghost btn-sm" onClick={saveNote} disabled={note === savedNote}>Update board</button>
            </div>
          )}

          <div className="card stack">
            {mode === "studio" && (
              <label className="field">
                <span>Customer's WhatsApp number</span>
                <input className="input" inputMode="tel" autoComplete="off" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
            )}
            <button className="btn btn-whatsapp btn-block" onClick={whatsapp}>
              {mode === "studio" ? "Send on WhatsApp" : "Share on WhatsApp"}
            </button>
            <div className="grid-2" style={{ gap: 10 }}>
              <button className="btn btn-ghost" onClick={nativeShare} disabled={!board}>Share image…</button>
              <button className="btn btn-ghost" onClick={download} disabled={!board}>Download</button>
            </div>
            <button className="btn-link" onClick={copyLink}>Copy 24-hour link</button>
            {mode === "studio" && <p className="small muted" style={{ margin: 0 }}>The number is used only to open WhatsApp on this device. We don't store it.</p>}
          </div>

          {(salon.bookingUrl || salon.whatsappNumber) && (
            <div className="card panel-dark stack">
              <h3 style={{ margin: 0 }}>Love one of these?</h3>
              {salon.bookingUrl && <a className="btn btn-accent btn-block" href={salon.bookingUrl} target="_blank" rel="noopener noreferrer">Book with {salon.name}</a>}
              {salon.whatsappNumber && (
                <a className="btn btn-ghost btn-block" style={{ color: "var(--paper)", borderColor: "rgba(255,255,255,.3)" }}
                  href={`https://wa.me/${salon.whatsappNumber}?text=${encodeURIComponent(`Hi ${salon.name}, I'd like to book: ${items.map((i) => i.name).join(", ")}`)}`}
                  target="_blank" rel="noopener noreferrer">
                  Message the salon
                </a>
              )}
            </div>
          )}
          <p className="disclaimer" style={{ textAlign: "left" }}>{AI_DISCLAIMER}</p>
        </div>
      </div>
    </div>
  );
}
