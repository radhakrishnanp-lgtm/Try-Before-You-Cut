import type { Metadata } from "next";
import { signedUrl } from "@/lib/blob";
import { AI_DISCLAIMER } from "@/lib/copy";
import { publicSalon } from "@/lib/public";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Stylist Board", robots: { index: false, follow: false } };

/** Public, expiring Stylist Board shared over WhatsApp. */
export default async function Board({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = token.length >= 12 ? await store.getSessionByShareToken(token) : null;
  const live = session && !session.deletedAt && new Date(session.expiresAt) > new Date();
  const salonRow = session ? await store.getSalon(session.salonId) : null;
  if (!session || !live || !salonRow) {
    return (
      <main className="narrow flow center">
        <div className="eyebrow">Stylist Board</div>
        <h1>This preview has expired</h1>
        <p className="muted">For privacy, hairstyle previews are deleted automatically after 24 hours.</p>
        {salonRow && <a className="btn btn-accent" href={`/t/${salonRow.slug}`}>Try again at {salonRow.name}</a>}
      </main>
    );
  }
  const salon = publicSalon(salonRow);
  const results = (await store.listResults(session.id)).filter((r) => r.status === "ready" && r.imageKey);
  const picked = session.chosenResultIds.length ? results.filter((r) => session.chosenResultIds.includes(r.id)) : results.slice(-4);
  const styles = new Map((await store.listStyles({ salonId: salon.id, includeInactive: true })).map((s) => [s.id, s]));
  const items = await Promise.all(picked.slice(0, 4).map(async (r) => ({ id: r.id, name: styles.get(r.styleId)?.name ?? "Look", url: await signedUrl(r.imageKey!, 3600) })));
  await store.logAccess({ salonId: salon.id, sessionId: session.id, actor: "share", action: "board.viewed" });
  const hours = Math.max(1, Math.round((new Date(session.expiresAt).getTime() - Date.now()) / 3600_000));

  return (
    <div style={{ ["--accent" as string]: salon.accentColor }}>
      <header className="topbar">
        <div className="container topbar-inner">
          <span className="brand">
            {salon.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="brand-logo" src={salon.logoUrl} alt={salon.name} />
            ) : (
              <span className="brand-mark" aria-hidden>{salon.name[0]}</span>
            )}
            <span className="brand-name">{salon.name}</span>
          </span>
          <span className="badge">Expires in ~{hours}h</span>
        </div>
      </header>
      <main className="container flow">
        <div className="eyebrow">Stylist Board</div>
        <h1>Your shortlisted looks</h1>
        {session.stylistNote && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Stylist's note</div>
            <p className="serif" style={{ fontSize: "1.25rem", margin: 0 }}>{session.stylistNote}</p>
          </div>
        )}
        <div className="result-grid">
          {items.map((i) => (
            <figure key={i.id} className="result-card" style={{ margin: 0 }}>
              <div className="result-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i.url} alt={i.name} />
                <span className="ai-tag">AI preview</span>
              </div>
              <figcaption className="result-meta"><h3>{i.name}</h3></figcaption>
            </figure>
          ))}
        </div>
        <p className="disclaimer">{AI_DISCLAIMER}</p>
        <div className="card panel-dark center" style={{ marginTop: 28 }}>
          <h2>Ready for the real thing?</h2>
          <div className="row" style={{ justifyContent: "center" }}>
            {salon.bookingUrl && <a className="btn btn-accent" href={salon.bookingUrl} target="_blank" rel="noopener noreferrer">Book with {salon.name}</a>}
            <a className="btn btn-ghost" href={`/t/${salon.slug}`}>Try your own looks</a>
          </div>
        </div>
      </main>
    </div>
  );
}
