"use client";

import { AI_DISCLAIMER } from "../copy";

export interface BrandInfo {
  name: string;
  accentColor: string;
  logoUrl: string | null;
  bookingUrl: string | null;
}

async function loadImage(url: string): Promise<ImageBitmap> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`image ${res.status}`);
  return createImageBitmap(await res.blob());
}

function toBlob(canvas: HTMLCanvasElement, type = "image/jpeg", q = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), type, q));
}

function cover(ctx: CanvasRenderingContext2D, img: ImageBitmap, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// next/font hashes family names, so read the real ones from the CSS variables.
function family(variable: string, fallback: string): string {
  const v = typeof document !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue(variable).trim() : "";
  return v ? `${v}, ${fallback}` : fallback;
}
const SERIF = "serif";
const SANS = "sans";
const font = (kind: string, px: number, weight = 600) =>
  `${weight} ${px}px ${kind === SERIF ? family("--font-fraunces", "Georgia, serif") : family("--font-manrope", "system-ui, sans-serif")}`;

/** Result image with the salon's name and the AI label burnt in. */
export async function watermarked(url: string, brand: BrandInfo, styleName: string): Promise<Blob> {
  const img = await loadImage(url);
  const band = Math.round(img.width * 0.11);
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height + band;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = "#0e0c0b";
  ctx.fillRect(0, img.height, c.width, band);
  ctx.fillStyle = brand.accentColor;
  ctx.fillRect(0, img.height, c.width, Math.max(2, band * 0.03));
  const pad = band * 0.32;
  ctx.fillStyle = "#f4eee5";
  ctx.font = font(SERIF, Math.round(band * 0.3), 500);
  ctx.textBaseline = "middle";
  ctx.fillText(brand.name, pad, img.height + band * 0.38);
  ctx.fillStyle = brand.accentColor;
  ctx.font = font(SANS, Math.round(band * 0.17), 700);
  ctx.fillText(`${styleName.toUpperCase()}  ·  AI PREVIEW`, pad, img.height + band * 0.72);
  ctx.fillStyle = "#b8afa2";
  ctx.textAlign = "right";
  ctx.font = font(SANS, Math.round(band * 0.14), 500);
  ctx.fillText("Actual results may vary", c.width - pad, img.height + band * 0.72);
  // Small corner label on the image itself so crops keep the AI marker.
  const tag = Math.round(img.width * 0.028);
  ctx.textAlign = "left";
  ctx.font = font(SANS, tag, 700);
  const label = "AI-GENERATED";
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = "rgba(28,27,25,0.7)";
  roundRect(ctx, pad * 0.6, img.height - tag * 2.6, tw + tag * 1.4, tag * 1.9, tag);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(label, pad * 0.6 + tag * 0.7, img.height - tag * 1.65);
  return toBlob(c);
}

export interface BoardItem {
  url: string;
  name: string;
}

/** A branded "Stylist Board": before photo + chosen looks + note + booking link. */
export async function stylistBoard(opts: { brand: BrandInfo; before: string | null; items: BoardItem[]; note: string | null }): Promise<Blob> {
  const W = 1600;
  const pad = 72;
  const items = opts.items.slice(0, 4);
  const tiles = [...(opts.before ? [{ url: opts.before, name: "Before" }] : []), ...items];
  const cols = tiles.length <= 2 ? tiles.length : tiles.length === 3 ? 3 : tiles.length === 4 ? 2 : 3;
  const rows = Math.ceil(tiles.length / cols);
  const gap = 28;
  const tileW = (W - pad * 2 - gap * (cols - 1)) / cols;
  const tileH = tileW * (4 / 3);
  const header = 220;
  const noteH = opts.note ? 150 : 0;
  const footer = 190;
  const H = header + rows * (tileH + 70) + noteH + footer;

  const c = document.createElement("canvas");
  c.width = W;
  c.height = Math.round(H);
  const ctx = c.getContext("2d")!;
  // Dark luxe background with a warm glow in the accent colour.
  ctx.fillStyle = "#0e0c0b";
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.85, 0, 0, W * 0.85, 0, W * 0.9);
  glow.addColorStop(0, `${opts.brand.accentColor}40`);
  glow.addColorStop(1, "rgba(14,12,11,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Header
  let x = pad;
  if (opts.brand.logoUrl) {
    try {
      const logo = await loadImage(opts.brand.logoUrl);
      const lh = 84;
      const lw = Math.min(260, (logo.width / logo.height) * lh);
      // Light plate so dark logos stay readable on the dark board.
      ctx.fillStyle = "#f4eee5";
      roundRect(ctx, pad - 12, 58, lw + 24, lh + 24, 18);
      ctx.fill();
      ctx.drawImage(logo, pad, 70, lw, lh);
      x = pad + lw + 40;
    } catch {
      /* logo is optional */
    }
  }
  ctx.fillStyle = "#f4eee5";
  ctx.textBaseline = "alphabetic";
  ctx.font = font(SERIF, 64, 500);
  ctx.fillText(opts.brand.name, x, 128);
  ctx.fillStyle = opts.brand.accentColor;
  ctx.font = font(SANS, 24, 700);
  ctx.fillText("YOUR STYLIST BOARD", x, 168);
  ctx.fillStyle = opts.brand.accentColor;
  ctx.fillRect(pad, header - 24, W - pad * 2, 3);

  // Tiles
  const imgs = await Promise.all(tiles.map((t) => loadImage(t.url).catch(() => null)));
  tiles.forEach((t, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const tx = pad + col * (tileW + gap);
    const ty = header + row * (tileH + 70);
    ctx.save();
    roundRect(ctx, tx, ty, tileW, tileH, 22);
    ctx.clip();
    ctx.fillStyle = "#1b1815";
    ctx.fillRect(tx, ty, tileW, tileH);
    const img = imgs[i];
    if (img) cover(ctx, img, tx, ty, tileW, tileH);
    ctx.restore();
    if (t.name !== "Before") {
      ctx.font = font(SANS, 18, 700);
      const label = "AI PREVIEW";
      const lw = ctx.measureText(label).width + 28;
      ctx.fillStyle = "rgba(28,27,25,0.72)";
      roundRect(ctx, tx + 16, ty + tileH - 50, lw, 34, 17);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(label, tx + 30, ty + tileH - 27);
    }
    ctx.fillStyle = "#f4eee5";
    ctx.font = font(SERIF, 34, 500);
    ctx.fillText(t.name, tx, ty + tileH + 48);
  });

  let y = header + rows * (tileH + 70) + 20;
  if (opts.note) {
    ctx.fillStyle = opts.brand.accentColor;
    ctx.font = font(SANS, 22, 700);
    ctx.fillText("STYLIST'S NOTE", pad, y + 20);
    ctx.fillStyle = "#f4eee5";
    ctx.font = font(SERIF, 32, 400);
    wrap(ctx, opts.note, pad, y + 66, W - pad * 2, 42, 2);
    y += noteH;
  }

  // Footer
  ctx.fillStyle = "#171411";
  ctx.fillRect(0, H - footer + 30, W, footer);
  ctx.fillStyle = opts.brand.accentColor;
  ctx.fillRect(0, H - footer + 30, W, 2);
  ctx.fillStyle = "#f4eee5";
  ctx.font = font(SERIF, 38, 500);
  ctx.fillText(opts.brand.bookingUrl ? "Book this look" : `Visit ${opts.brand.name}`, pad, H - footer + 104);
  if (opts.brand.bookingUrl) {
    ctx.fillStyle = opts.brand.accentColor;
    ctx.font = font(SANS, 26, 700);
    ctx.fillText(opts.brand.bookingUrl.replace(/^https?:\/\//, ""), pad, H - footer + 146);
  }
  ctx.fillStyle = "#a79d8f";
  ctx.textAlign = "right";
  ctx.font = font(SANS, 20, 500);
  wrapRight(ctx, AI_DISCLAIMER, W - pad, H - footer + 100, 640, 28);
  ctx.fillStyle = "#6f675d";
  ctx.font = font(SANS, 17, 600);
  ctx.fillText("Made with Try-Before-You-Cut", W - pad, H - 28);
  return toBlob(c);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number, maxLines: number) {
  const words = text.split(/\s+/);
  let line = "";
  let n = 0;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > max && line) {
      ctx.fillText(n === maxLines - 1 ? `${line}…` : line, x, y + n * lh);
      if (++n >= maxLines) return;
      line = w;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y + n * lh);
}

function wrapRight(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > max && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Native share sheet with the image file, where the browser supports it. */
export async function shareFile(blob: Blob, filename: string, text: string): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return true;
    } catch (err) {
      if ((err as DOMException).name === "AbortError") return true;
    }
  }
  return false;
}
