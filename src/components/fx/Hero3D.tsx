"use client";
import { useEffect, useRef } from "react";
import { StyleArt } from "@/components/StyleArt";

/** Layered 3D scene that turns toward the cursor; floats gently on touch devices. */
export function Hero3D() {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        stage.current?.style.setProperty("--sry", `${-14 + x * 26}deg`);
        stage.current?.style.setProperty("--srx", `${6 - y * 16}deg`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="scene" aria-hidden>
      <div className="stage" ref={stage}>
        <div className="halo" />

        {/* back: "before" */}
        <div className="layer" style={{ inset: "8% 38% 22% -22%", transform: "translateZ(-90px) rotateY(10deg)" }}>
          <div className="glass-tile float d2" style={{ height: "100%", display: "grid", placeItems: "center", padding: 18 }}>
            <StyleArt art={{ top: 0.35, sides: "short", fringe: "none" }} texture="straight" />
            <span className="ai-tag" style={{ color: "#fff" }}>Before</span>
          </div>
        </div>

        {/* center: the look */}
        <div className="layer" style={{ inset: 0, transform: "translateZ(40px)" }}>
          <div className="glass-tile float" style={{ height: "100%", position: "relative", display: "grid", placeItems: "center", padding: 26, background: "radial-gradient(circle at 50% 35%, rgba(214,171,99,.22), rgba(20,17,15,.9) 70%)" }}>
            <StyleArt art={{ top: 0.6, sides: "chest", fringe: "curtain" }} texture="wavy" />
            <span className="ai-tag">AI preview · Butterfly cut</span>
          </div>
        </div>

        {/* front chips */}
        <div className="layer" style={{ right: "-14%", top: "12%", transform: "translateZ(130px)" }}>
          <div className="glass-tile float d3" style={{ padding: "12px 16px", borderRadius: 16 }}>
            <div className="small muted">Likeness</div>
            <div className="serif" style={{ fontSize: "1.6rem" }}><span className="text-gold" style={{ fontStyle: "normal" }}>98%</span> ✓</div>
          </div>
        </div>
        <div className="layer" style={{ left: "-16%", bottom: "6%", transform: "translateZ(170px)" }}>
          <div className="glass-tile float d2" style={{ padding: "12px 16px", borderRadius: 16, display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#3ccf7f,#1f9d5a)", display: "grid", placeItems: "center", color: "#04140b", fontWeight: 900 }}>✓</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: ".9rem" }}>Sent to WhatsApp</div>
              <div className="small muted">Stylist Board · 4 looks</div>
            </div>
          </div>
        </div>
        <div className="layer" style={{ right: "-6%", bottom: "-6%", transform: "translateZ(90px)" }}>
          <div className="glass-tile float d3" style={{ width: 96, padding: 8, borderRadius: 18 }}>
            <StyleArt art={{ top: 0.75, sides: "jaw", fringe: "textured" }} texture="curly" />
          </div>
        </div>
      </div>
    </div>
  );
}
