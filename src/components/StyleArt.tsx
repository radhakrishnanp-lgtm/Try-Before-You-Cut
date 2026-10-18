import type { StyleArt as Art, Texture } from "@/lib/types";

/**
 * Original, procedurally drawn line-art thumbnail for a style. Keeps the
 * catalogue free of third-party photos until licensed reference images are
 * shot on Indian models.
 */
const CX = 60;
const LENGTH_Y: Record<Art["sides"], number> = { faded: 0, short: 0, ear: 76, jaw: 98, shoulder: 116, chest: 136 };
const BACK_W: Record<Art["sides"], number> = { faded: 0, short: 0, ear: 27, jaw: 29, shoulder: 33, chest: 35 };

function hairline(fringe: Art["fringe"]): string {
  switch (fringe) {
    case "straight":
      return "L83 58 L83 55 Q60 58 37 55 L37 58";
    case "side":
      return "L83 64 C74 57 54 44 37 60";
    case "curtain":
      return "L83 72 Q72 52 60 45 Q48 52 37 72";
    case "textured":
      return "L83 58 L79 52 L75 56 L70 50 L65 55 L60 49 L55 55 L50 50 L45 56 L41 52 L37 58";
    case "swept-back":
      return "L83 58 Q60 36 37 58";
    default:
      return "L83 60 Q60 40 37 60";
  }
}

export function StyleArt({ art, texture, title }: { art: Art; texture?: Texture; title?: string }) {
  const crownY = 36 - art.top * 16;
  const bottom = LENGTH_Y[art.sides];
  const w = BACK_W[art.sides];
  const long = bottom > 0;
  // Unique gradient id per thumbnail so many can share a page.
  const gid = `hair-${art.sides}-${art.fringe}-${art.extra ?? "x"}-${Math.round(art.top * 100)}-${texture ?? "n"}`;
  const hair = `url(#${gid})`;
  const skin = "var(--art-skin, #1e1b18)";
  const line = "var(--art-line, #d6ab63)";

  const cap = `M37 62 C35 ${crownY + 18} 46 ${crownY} ${CX} ${crownY} C74 ${crownY} 85 ${crownY + 18} 83 62 ${hairline(art.fringe)} Z`;
  const back = long
    ? `M${CX - w} ${bottom} C${CX - w - 3} 70 ${CX - w + 1} ${crownY + 8} ${CX} ${crownY} C${CX + w - 1} ${crownY + 8} ${CX + w + 3} 70 ${CX + w} ${bottom} Q${CX} ${bottom + 5} ${CX - w} ${bottom} Z`
    : "";
  const strand = (side: -1 | 1) => {
    const x0 = CX + side * 23;
    const xb = CX + side * (w - 3);
    return `M${x0} 58 C${x0 + side * 3} 74 ${xb} ${bottom - 18} ${xb} ${bottom} L${xb - side * 9} ${bottom - 2} C${x0 - side * 6} ${bottom - 20} ${x0 - side * 4} 74 ${x0 - side * 2} 62 Z`;
  };

  const curls = texture === "curly";
  const waves = texture === "wavy";

  return (
    <svg viewBox="0 0 120 140" role="img" aria-label={title ?? "Hairstyle illustration"}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="var(--art-hair-1, #f1d39a)" />
          <stop offset="1" stopColor="var(--art-hair-2, #a47a3c)" />
        </linearGradient>
      </defs>
      <path d="M16 140 C20 117 40 110 52 106 L68 106 C80 110 100 117 104 140 Z" fill="var(--art-body, #24201c)" stroke={line} strokeWidth="1.2" />
      {back && <path d={back} fill={hair} />}
      {back && waves && (
        <g fill="none" stroke="#6b4f27" strokeWidth="1.1" opacity="0.8">
          <path d={`M${CX - w + 5} 80 q4 8 0 16 t0 16`} />
          <path d={`M${CX + w - 5} 80 q-4 8 0 16 t0 16`} />
        </g>
      )}
      <rect x="53" y="86" width="14" height="22" rx="5" fill={skin} stroke={line} strokeWidth="1.2" />
      <ellipse cx="38" cy="68" rx="3.5" ry="6" fill={skin} stroke={line} strokeWidth="1.2" />
      <ellipse cx="82" cy="68" rx="3.5" ry="6" fill={skin} stroke={line} strokeWidth="1.2" />
      <ellipse cx={CX} cy="66" rx="22" ry="27" fill={skin} stroke={line} strokeWidth="1.2" />
      {art.extra === "bun" && <circle cx={CX} cy={crownY - 7} r="9" fill={hair} />}
      {art.sides === "faded" && (
        <g fill={hair} opacity="0.32">
          <path d="M36 58 Q35 68 38 74 L41 74 Q39 66 40 58 Z" />
          <path d="M84 58 Q85 68 82 74 L79 74 Q81 66 80 58 Z" />
        </g>
      )}
      {art.sides === "short" && (
        <g fill={hair}>
          <path d="M36 58 Q35 66 37 71 L40 70 Q39 64 40 58 Z" />
          <path d="M84 58 Q85 66 83 71 L80 70 Q81 64 80 58 Z" />
        </g>
      )}
      <path d={cap} fill={hair} />
      {art.extra === "quiff" && <ellipse cx={CX - 4} cy={crownY + 3} rx="17" ry="8" fill={hair} />}
      {art.extra === "hawk" && (
        <path d={`M48 ${crownY + 6} L52 ${crownY - 8} L56 ${crownY + 3} L60 ${crownY - 11} L64 ${crownY + 3} L68 ${crownY - 8} L72 ${crownY + 6} Z`} fill={hair} />
      )}
      {long && art.sides !== "ear" && (
        <g fill={hair}>
          <path d={strand(-1)} />
          <path d={strand(1)} />
        </g>
      )}
      {curls && (
        <g fill={hair}>
          {Array.from({ length: 9 }, (_, i) => {
            const t = (i / 8) * Math.PI;
            return <circle key={i} cx={CX - Math.cos(t) * 25} cy={crownY + 16 - Math.sin(t) * 16} r={4.2} />;
          })}
          {long &&
            Array.from({ length: 4 }, (_, i) => (
              <g key={`s${i}`}>
                <circle cx={CX - w + 2} cy={74 + i * ((bottom - 74) / 4)} r={4} />
                <circle cx={CX + w - 2} cy={74 + i * ((bottom - 74) / 4)} r={4} />
              </g>
            ))}
        </g>
      )}
      {art.fringe === "swept-back" && (
        <g fill="none" stroke="#6b4f27" strokeWidth="1" opacity="0.9">
          <path d={`M50 50 Q52 ${crownY + 8} 58 ${crownY + 3}`} />
          <path d={`M60 48 Q62 ${crownY + 8} 68 ${crownY + 4}`} />
        </g>
      )}
    </svg>
  );
}
