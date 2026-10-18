import Link from "next/link";
import { Hero3D } from "@/components/fx/Hero3D";
import { Tilt } from "@/components/fx/Tilt";
import { SiteHeader } from "@/components/SiteHeader";
import { StyleArt } from "@/components/StyleArt";
import { config } from "@/lib/config";
import { CATALOGUE } from "@/lib/styles/catalogue";

export const dynamic = "force-dynamic";

const STEPS = [
  ["Consent & photo", "The customer agrees on screen, then takes one selfie on the salon tablet or their own phone. We check the light, the angle and that it's just them."],
  ["Pick up to four looks", "40 cuts Indian salons actually do: step cut, U-cut, butterfly, curly taper and more. Filtered by length and the customer's own hair texture."],
  ["See it on their face", "Each look is rendered at 2K in parallel, checked by AI that it's still the same person, then compared side by side with a drag slider."],
  ["Send the Stylist Board", "A board with the salon's logo, chosen looks, the stylist's note and a booking link goes straight to the customer's WhatsApp."],
];

export default function Home() {
  const names = CATALOGUE.map((s) => s.name);
  return (
    <>
      <SiteHeader links={[{ href: "/t/demo", label: "Live demo" }, { href: "/login", label: "Salon login" }]} />
      <main>
        <section className="hero container">
          <div className="hero-grid">
            <div className="enter">
              <div className="eyebrow">AI hair consultations for salons</div>
              <h1>
                See the cut <em>before</em> the scissors.
              </h1>
              <p style={{ fontSize: "1.18rem", maxWidth: 560 }} className="muted">
                Try-Before-You-Cut shows your customers realistic previews of new haircuts on their own face, in seconds, then
                sends a Stylist Board branded with your salon to their WhatsApp. Fewer nervous chairs, more confident yeses.
              </p>
              <div className="row" style={{ marginTop: 30 }}>
                <Link className="btn" href="/t/demo">Try the demo salon →</Link>
                <Link className="btn btn-ghost" href="/login">Salon login</Link>
              </div>
              <div className="row small muted" style={{ marginTop: 26, gap: 22 }}>
                <span>✦ No app to install</span>
                <span>✦ Photos deleted in 24h</span>
                <span>✦ Your logo on every board</span>
              </div>
            </div>
            <Hero3D />
          </div>
        </section>

        <div className="marquee" aria-hidden>
          <div className="marquee-track">
            {[...names, ...names].map((n, i) => <span key={i}>{n}</span>)}
          </div>
        </div>

        <section className="section container">
          <div className="center" style={{ marginBottom: 40 }}>
            <div className="eyebrow">How it works</div>
            <h2>From nervous to <em>booked</em> in four taps.</h2>
          </div>
          <div className="grid-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {STEPS.map(([t, b], i) => (
              <Tilt key={t} className="card" max={7}>
                <div className="feature-num depth-2">0{i + 1}</div>
                <h3 className="depth-1" style={{ marginTop: 14 }}>{t}</h3>
                <p className="muted small depth-1" style={{ margin: 0 }}>{b}</p>
              </Tilt>
            ))}
          </div>
        </section>

        <section className="section container">
          <div className="hero-grid" style={{ alignItems: "center" }}>
            <div>
              <div className="eyebrow">Made for Indian hair</div>
              <h2>Real textures. Real faces. <em>Their</em> face.</h2>
              <p className="muted">
                Every look is generated from the customer's own photo and their own hair texture: straight, wavy or curly.
                An AI check compares each result with the original photo, and if the face changes, the look is retried or
                hidden, and the credit goes back to the salon.
              </p>
              <ul className="muted" style={{ paddingLeft: 18, lineHeight: 2 }}>
                <li>Explicit consent before any photo, with guardian consent for under-18s</li>
                <li>Photos and previews deleted automatically after 24 hours</li>
                <li>Never used to train AI, never shown publicly</li>
              </ul>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {CATALOGUE.filter((_, i) => i % 5 === 0).slice(0, 6).map((s) => (
                <Tilt key={s.id} className="card" max={14} style={{ padding: 10, borderRadius: 18 }}>
                  <div className="depth-2"><StyleArt art={s.art} texture={s.textures[0]} title={s.name} /></div>
                  <div className="small center depth-1" style={{ marginTop: 6 }}>{s.name}</div>
                </Tilt>
              ))}
            </div>
          </div>
        </section>

        <section className="section container">
          <Tilt className="card panel-dark" max={4} style={{ padding: "46px 34px" }}>
            <div className="hero-grid" style={{ alignItems: "center" }}>
              <div className="depth-1">
                <div className="eyebrow">Simple credits, paid by the salon</div>
                <h2>Customers never see a <em>paywall</em>.</h2>
                <p className="muted">
                  Each salon gets its own login and a credit balance. One generated look uses {config.creditsPerImage} credits; a
                  look that fails the quality check is refunded automatically. Top up any time.
                </p>
              </div>
              <div className="stats depth-2">
                <div className="card stat"><div className="num">{config.creditsPerImage}</div><div className="lbl">credits per look</div></div>
                <div className="card stat"><div className="num">2K</div><div className="lbl">portrait previews</div></div>
                <div className="card stat"><div className="num">24h</div><div className="lbl">auto-delete</div></div>
                <div className="card stat"><div className="num">0</div><div className="lbl">customer accounts needed</div></div>
              </div>
            </div>
          </Tilt>
        </section>
      </main>
      <footer className="footer">
        <div className="container spread">
          <span>© {new Date().getFullYear()} Try-Before-You-Cut. AI previews are illustrative; actual results may vary.</span>
          <span className="row"><Link href="/privacy">Privacy</Link><Link href="/terms">Salon terms</Link></span>
        </div>
      </footer>
    </>
  );
}
