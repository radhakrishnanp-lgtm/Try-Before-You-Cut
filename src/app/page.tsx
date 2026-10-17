import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { StyleArt } from "@/components/StyleArt";
import { PLANS } from "@/lib/types";

export default function Home() {
  return (
    <>
      <SiteHeader links={[{ href: "/login", label: "Salon login" }]} />
      <main>
        <section className="hero container">
          <div className="hero-grid">
            <div>
              <div className="eyebrow">For premium salons in India</div>
              <h1>See it before the scissors.</h1>
              <p style={{ fontSize: "1.2rem" }} className="muted">
                Keshkala turns the haircut consultation into a confident yes. Your customer takes one photo and sees realistic
                previews of up to four styles on their own face, then leaves with a Stylist Board branded with your salon.
              </p>
              <div className="row" style={{ marginTop: 24 }}>
                <Link className="btn btn-accent" href="/t/demo">Try the demo salon</Link>
                <Link className="btn btn-ghost" href="/login">Salon login</Link>
              </div>
              <p className="small muted" style={{ marginTop: 16 }}>No app to install. Works on the salon tablet and on customers' phones.</p>
            </div>
            <div className="hero-art" aria-hidden>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, width: "80%" }}>
                {[
                  { top: 0.6, sides: "chest", fringe: "curtain" },
                  { top: 0.45, sides: "jaw", fringe: "straight" },
                  { top: 0.6, sides: "faded", fringe: "none", extra: "quiff" },
                  { top: 0.75, sides: "shoulder", fringe: "textured" },
                ].map((art, i) => (
                  <div key={i} style={{ background: "#f7f3ec", borderRadius: 18, padding: 10 }}>
                    <StyleArt art={art as never} texture={i === 3 ? "curly" : "straight"} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section panel-dark">
          <div className="container grid-2">
            {[
              ["Made for Indian hair", "A curated catalogue of 40 cuts salons actually do, from step cuts and U-cuts to curly tapers, rendered in your customer's own texture."],
              ["Their face stays theirs", "Every result is checked against the original photo. If the AI changes the face, the look is retried or not shown, and the credit is refunded."],
              ["Branded, shareable boards", "One tap sends a Stylist Board with your logo, the chosen looks and your booking link straight to the customer's WhatsApp."],
              ["Private by default", "Explicit DPDP consent before any photo. Photos and previews are deleted after 24 hours and never used for training."],
            ].map(([t, b]) => (
              <div key={t}>
                <h3 style={{ color: "var(--brass)" }}>{t}</h3>
                <p className="muted">{b}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section container">
          <div className="eyebrow">Simple pricing, paid by the salon</div>
          <h2>Customers never see a paywall.</h2>
          <div className="grid-2" style={{ marginTop: 24 }}>
            {(["pilot", "starter", "pro", "chain"] as const).map((p) => (
              <div key={p} className="card">
                <h3>{PLANS[p].name}</h3>
                <div className="price">{PLANS[p].priceInr === null ? "Custom" : PLANS[p].priceInr === 0 ? "Free" : `₹${PLANS[p].priceInr.toLocaleString("en-IN")}`}<span className="small muted">{PLANS[p].priceInr ? " / month" : ""}</span></div>
                <p className="muted small" style={{ marginTop: 8 }}>
                  {p === "chain" ? "Multiple branches, volume pricing" : `${PLANS[p].tryOns.toLocaleString("en-IN")} try-ons`}
                  {PLANS[p].branding ? " · logo & colour branding" : ""}
                  {PLANS[p].multiDevice ? " · multiple devices" : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="footer">
        <div className="container spread">
          <span>© {new Date().getFullYear()} Keshkala. AI previews are illustrative; actual results may vary.</span>
          <span className="row"><Link href="/privacy">Privacy</Link><Link href="/terms">Salon terms</Link></span>
        </div>
      </footer>
    </>
  );
}
