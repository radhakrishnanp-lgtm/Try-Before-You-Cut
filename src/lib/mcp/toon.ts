/**
 * Minimal TOON (Token-Oriented Object Notation) reader for Magnific's text
 * responses, e.g. `creations_get`:
 *
 *   identifier: gOMYqTKSXO
 *   status: completed
 *   url: "https://…"
 *   metadata:
 *     width: 64
 *   tags[2]: a,b
 *   items[2]{id,name}:
 *     1,Alpha
 *     2,Beta
 *
 * Unknown shapes degrade to strings rather than throwing.
 */
type Val = string | number | boolean | null | Val[] | { [k: string]: Val };

function scalar(raw: string): Val {
  const v = raw.trim();
  if (v === "") return "";
  if (v.startsWith('"') && v.endsWith('"')) {
    try {
      return JSON.parse(v) as string;
    } catch {
      return v.slice(1, -1);
    }
  }
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

/** Split a CSV-ish row, respecting double quotes. */
function splitRow(row: string, delim = ","): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (c === '"' && row[i - 1] !== "\\") q = !q;
    if (c === delim && !q) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const indentOf = (l: string) => l.length - l.trimStart().length;
const HEADER = /^([^:[\]{}]+?)(?:\[(\d+)\])?(?:\{([^}]*)\})?:(.*)$/;

export function parseToon(text: string): Record<string, Val> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  let i = 0;

  function block(indent: number): Record<string, Val> {
    const obj: Record<string, Val> = {};
    while (i < lines.length && indentOf(lines[i]) >= indent) {
      const line = lines[i].trim();
      const m = line.match(HEADER);
      i++;
      if (!m) continue;
      const [, key, count, fields, rest] = m;
      const k = key.trim();
      const childIndent = i < lines.length ? indentOf(lines[i]) : 0;
      const hasChildren = childIndent > indent && rest.trim() === "";
      if (count !== undefined && fields !== undefined) {
        const cols = fields.split(",").map((f) => f.trim());
        const rows: Val[] = [];
        while (i < lines.length && indentOf(lines[i]) > indent) {
          const cells = splitRow(lines[i].trim());
          rows.push(Object.fromEntries(cols.map((c, j) => [c, scalar(cells[j] ?? "")])));
          i++;
        }
        obj[k] = rows;
      } else if (count !== undefined) {
        if (rest.trim()) obj[k] = splitRow(rest.trim()).map(scalar);
        else {
          const items: Val[] = [];
          while (i < lines.length && indentOf(lines[i]) > indent) {
            const l = lines[i].trim();
            i++;
            items.push(l.startsWith("- ") ? scalar(l.slice(2)) : scalar(l));
          }
          obj[k] = items;
        }
      } else if (hasChildren) {
        obj[k] = block(childIndent);
      } else {
        obj[k] = scalar(rest);
      }
    }
    return obj;
  }
  return block(0);
}
