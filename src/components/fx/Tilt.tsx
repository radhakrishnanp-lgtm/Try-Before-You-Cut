"use client";
import { createElement, useRef, type ElementType, type HTMLAttributes, type PointerEvent, type ReactNode } from "react";

type Props = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  /** Maximum tilt in degrees. */
  max?: number;
  children?: ReactNode;
  [key: string]: unknown;
};

/**
 * Mouse-driven 3D tilt with a moving glare. Mouse/pen only (touch scrolls
 * normally); prefers-reduced-motion disables it in CSS.
 */
export function Tilt({ as = "div", max = 9, className = "", children, onPointerMove, onPointerLeave, ...rest }: Props) {
  const ref = useRef<HTMLElement>(null);
  const frame = useRef(0);

  const move = (e: PointerEvent<HTMLElement>) => {
    onPointerMove?.(e);
    if (e.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.classList.add("is-active");
      el.style.setProperty("--ry", `${(px - 0.5) * 2 * max}deg`);
      el.style.setProperty("--rx", `${(0.5 - py) * 2 * max}deg`);
      el.style.setProperty("--gx", `${px * 100}%`);
      el.style.setProperty("--gy", `${py * 100}%`);
      el.style.setProperty("--ga", "1");
    });
  };
  const leave = (e: PointerEvent<HTMLElement>) => {
    onPointerLeave?.(e);
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.classList.remove("is-active");
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--ga", "0");
  };

  return createElement(
    as,
    { ...rest, ref, className: `tilt ${className}`.trim(), onPointerMove: move, onPointerLeave: leave },
    children,
    createElement("span", { className: "glare", "aria-hidden": true }),
  );
}
