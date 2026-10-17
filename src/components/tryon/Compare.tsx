"use client";
import { useState } from "react";

/** Big drag-to-compare before/after slider (pointer, touch and keyboard). */
export function BeforeAfter({ before, after, alt }: { before: string; after: string; alt: string }) {
  const [pos, setPos] = useState(50);
  // A transparent full-size range input handles mouse, touch and keyboard.
  return (
    <div className="compare">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={before} alt="Before" />
      <div className="after-clip" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt={alt} />
      </div>
      <span className="label l">Before</span>
      <span className="label r">After · AI</span>
      <div className="handle" style={{ left: `${pos}%` }}>
        <div className="knob" aria-hidden>⟷</div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={0.5}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Drag to compare before and after"
      />
    </div>
  );
}
