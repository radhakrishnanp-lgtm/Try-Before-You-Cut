import assert from "node:assert/strict";
import { test } from "node:test";
import { buildHairPrompt, GUARDRAILS } from "../src/lib/ai/prompt.ts";
import { cosineSimilarity } from "../src/lib/identity/similarity.ts";
import { sniffImage } from "../src/lib/image-meta.ts";
import { CATALOGUE } from "../src/lib/styles/catalogue.ts";

test("catalogue has ~40 unique, well-formed styles for both genders", () => {
  assert.equal(CATALOGUE.length, 40);
  assert.equal(new Set(CATALOGUE.map((s) => s.id)).size, CATALOGUE.length);
  assert.equal(CATALOGUE.filter((s) => s.gender === "men").length, 20);
  assert.equal(CATALOGUE.filter((s) => s.gender === "women").length, 20);
  for (const s of CATALOGUE) {
    assert.match(s.id, /^[mw]-[a-z0-9-]+$/);
    assert.ok(s.textures.length > 0, s.id);
    assert.ok(s.prompt.length > 40, s.id);
    assert.ok(!/skin tone|face shape|makeup|lighter|fairer/i.test(s.prompt), `${s.id} prompt should describe hair only`);
  }
  for (const t of ["straight", "wavy", "curly"] as const) {
    assert.ok(CATALOGUE.filter((s) => s.textures.includes(t)).length >= 10, `enough ${t} styles`);
  }
});

test("prompt always carries identity guardrails, strict mode adds more", () => {
  const p = buildHairPrompt({ stylePrompt: "a bob", texture: "curly" });
  assert.ok(p.includes("a bob"));
  assert.ok(p.includes(GUARDRAILS));
  assert.ok(p.includes("curly"));
  const strict = buildHairPrompt({ stylePrompt: "a bob", strict: true });
  assert.ok(strict.length > p.length - 60);
  assert.ok(strict.includes("previous attempt changed the face"));
});

test("cosine similarity", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.ok(Math.abs(cosineSimilarity([1, 2, 3], [2, 4, 6]) - 1) < 1e-9);
  assert.throws(() => cosineSimilarity([1], [1, 2]));
});

test("sniffImage reads PNG and JPEG dimensions and rejects junk", () => {
  const png = new Uint8Array(32);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const dv = new DataView(png.buffer);
  dv.setUint32(16, 800);
  dv.setUint32(20, 600);
  assert.deepEqual(sniffImage(png), { mime: "image/png", width: 800, height: 600 });

  // SOI, APP0 (len 16), SOF0 with h=480 w=640
  const jpeg = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0),
    0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02, 0x80, 0x03, 0, 0, 0, 0, 0, 0,
  ]);
  assert.deepEqual(sniffImage(jpeg), { mime: "image/jpeg", width: 640, height: 480 });
  assert.equal(sniffImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>")), null);
});
