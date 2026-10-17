# Keshkala: see it before the scissors

> **Working name.** "Keshkala" (*kesh*, hair + *kala*, art) replaces the generic tagline "Try Before You Cut". Search it at [ipindia.gov.in](https://ipindia.gov.in) (classes 9, 42 and 44) before you print anything.

Keshkala is a tablet-first PWA that salons use for hair consultations. A customer gives consent, takes one photo and picks up to four styles. The AI previews come back in parallel. The customer compares each one with a before/after slider and leaves with a salon-branded **Stylist Board** sent to their WhatsApp. Salons pay for it; customers never sign up and never hit a paywall.

## Quick start (demo mode, no keys needed)

```bash
npm install
npm run dev            # http://localhost:3000
```

If no Supabase keys are set, the app runs in **demo mode**:

- Data is kept in memory with a seeded salon, **Studio Amara** (`/t/demo`).
- The mock AI returns your original photo, so you can walk through the whole flow.
- The identity check is simulated.
- On `/login` you sign in as a demo **owner**, **stylist** or **platform admin**.

| URL | What it is |
| --- | --- |
| `/t/demo` | At-home flow (from the salon's link or QR code) |
| `/studio` | In-salon flow on the tablet, run by a stylist (sign in first) |
| `/dashboard` | Owner: usage, QR link, branding, styles, team |
| `/admin` | Platform admin: salons, plans and credits, global catalogue, **Check connections** |
| `/b/<token>` | Shared Stylist Board (expires with the session) |
| `/privacy`, `/terms` | DPDP notice and the salon terms summary |

```bash
npm test               # unit tests (catalogue, prompts, identity maths, image sniffing)
npm run typecheck
npm run build
npm start & npm run e2e   # Playwright walkthrough of the demo flow (screenshots → e2e-out/)
# Full pipeline without credits: fake Magnific MCP + fake LLM
node tests/e2e/fake-services.mjs &
MAGNIFIC_MCP_URL=http://localhost:4010/mcp MAGNIFIC_MCP_TOKEN=fake-token \
  LLM_BASE_URL=http://localhost:4011/v1 LLM_API_KEY=fake LLM_STREAM=1 AI_PROVIDERS=magnific npm start
```

## Production setup

1. **Supabase**
   - Create a project.
   - Run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql` (40 styles). To rebuild the seed after editing the catalogue, run `npm run seed:sql`.
   - Under Auth → URL configuration, add `https://<your-domain>/auth/callback` as a redirect URL.
   - Optional: enable `pg_cron` and uncomment the backup job at the end of the migration.
2. **Magnific MCP (image generation):** set `MAGNIFIC_MCP_TOKEN`. Optionally pick the model with `MAGNIFIC_IMAGE_MODEL` (default `imagen-nano-banana-2-lite`).
3. **LLM (vision checks):** set `LLM_API_KEY` for any OpenAI-compatible API. The default is OpenRouter with `qwen/qwen3.8-omni-flash`; change `LLM_BASE_URL` and `LLM_MODEL` to use another host or model.
4. **Optional, stricter identity check:** deploy `services/face-embed` and set `FACE_SERVICE_URL`. When it's set, it is used instead of the LLM. **In production the app refuses to generate looks if neither the LLM nor the face service is configured.**
5. **Optional fallbacks:** `GEMINI_API_KEY` and/or `REPLICATE_API_TOKEN`. These are used in the order given by `AI_PROVIDERS=magnific,gemini,flux`.
6. **Vercel:** import the repo and copy the values from `.env.example`. Set `APP_SECRET`, `CRON_SECRET`, `PLATFORM_ADMIN_EMAILS` and `NEXT_PUBLIC_APP_URL`. `vercel.json` runs the cleanup cron every hour. Generation routes need up to 120 s, which needs a plan that allows that function duration.
7. Sign in at `/login` with an admin email. Go to `/admin` → **New salon** and enter the owner's email. The owner can then sign in and set up branding.

## How it works

```
Browser (PWA)                          Next.js route handlers (Vercel)              Services
─────────────                          ─────────────────────────────               ────────
consent ─────────────── POST /api/sessions ── consent ledger + session token
photo ── resize, strip EXIF,
         on-device checks ──── POST /photo ── format/size ── photo check: 1 face? ───── LLM vision (Qwen via OpenRouter)
                                              store in private bucket                  or InsightFace if deployed
pick ≤4 ─────────────── POST /rounds ──────── Magnific: create session folder,
                                              upload photo once ──────────────────────── Magnific MCP
                                              reserve credits atomically (SQL)
  ┌─ POST /results/a/run ─┐                    images_generate (photo as reference) ─── Magnific (Nano Banana)
  ├─ POST /results/b/run ─┤  in parallel;      ↳ fallback ────────────────────────────── Gemini / FLUX
  └─ ...                 ─┘  each card fills   identity check: same person? style applied?
                             as it returns     ↳ fails → retry once (strict) → hide + refund credit
delete / 24h expiry ───────────────────────── trash the Magnific folder (cron retries on failure)
compare / board ── canvas watermark & board (client) ── POST /share ── 24h link /b/<token>
hourly cron ─────────────────────────────── erase expired photos/results; prune 1-year logs
```

- **Provider abstraction:** `src/lib/ai/` has one `ImageEditProvider` interface, and `AI_PROVIDERS=magnific,gemini,flux` sets the order they are tried. Providers that keep remote copies implement `prepare` and `cleanup`. To add HairFastGAN or another model later, write one more file.
- **Magnific MCP:** `src/lib/mcp/client.ts` keeps a pooled MCP client (bearer token, reconnects once on failure) and parses replies as JSON or TOON (`toon.ts`). `src/lib/ai/magnific.ts` gives each session its own folder, uploads the photo once (presigned PUT, then `creations_finalize_upload`), calls `images_generate` with it as an `image` reference, waits with `creations_wait`, and runs `folders_delete` on erase.
- **LLM:** `src/lib/llm.ts` works with any OpenAI-compatible API. It streams, keeps reasoning on, and passes `reasoning_details` back unmodified. A 400 mentioning reasoning is retried without passback, then without reasoning; 429/5xx are retried. Per-check models can be set with `LLM_MODEL_<CHECK>`.
- **Identity:** `src/lib/identity/`. The baseline embedding is taken at upload. Each result is compared to it, and a failing result gets one strict retry. Results that fail are never shown and their credit is refunded.
- **Data access:** `src/lib/store/` has a single `Store` interface with two implementations, Supabase and in-memory (demo).
- **Security model:**
  - Every table has RLS enabled and no policies. The browser cannot reach Postgres or Storage directly.
  - All access goes through route handlers. These check either the customer's session token (stored as an HMAC hash) or salon membership.
  - Images live in a private bucket and are served through 1-hour signed URLs. The API sends `no-store`, and the service worker never caches `/api` or `/b`.
- **Cost controls:**
  - Looks are reserved against salon credits in a single SQL statement before generating. Failures are refunded.
  - Limits: 4 styles per round and 6 rounds per session, plus per-IP rate limits.
  - The client downsizes photos to 1280 px before upload.

## Compliance checklist (DPDP Act 2023 and Rules 2025)

| Requirement | Where |
| --- | --- |
| Informed, explicit consent before capture (purpose, retention, withdrawal, grievance contact) | `components/tryon/Consent.tsx`, `lib/legal.ts` |
| Consent logged with timestamp, notice version, text hash and IP hash | `consents` table |
| Under-18 → guardian consent checkbox (also enforced in SQL) | Consent screen + `check (not is_minor or guardian_consent)` |
| Purpose limitation, no training | Prompt and provider choice; privacy policy; paid API terms |
| 24 h auto-deletion of photo, results, embedding, note and share link | `lib/cleanup.ts` + Vercel cron |
| "Delete my data now", which erases immediately and withdraws consent | Footer of every try-on screen → `DELETE /api/sessions/:id` |
| Access log kept 1 year | `access_logs`, pruned by the cron |
| AI-generated label + "actual results may vary" | On every card, slider, download (burnt in) and board |
| Salon = Data Fiduciary, Keshkala = Processor | `/terms`, `/privacy` (**drafts: get legal review**) |

## Decisions on the brief's open points

- **AI provider:** Magnific MCP (Nano Banana 2 Lite) is the default, with Gemini and FLUX as optional fallbacks. Compare Magnific models (e.g. `imagen-nano-banana-2-flash`, `imagen-nano-banana-2`) in the 10-photo bake-off.
- **Identity check:** the OpenAI-compatible vision model by default. It checks that the result is the same person, gives a likeness score of 0 to 1, and confirms the style was applied. InsightFace is an optional, stricter check.
- **Face embedding (optional):** InsightFace ArcFace (`buffalo_l`) as a small self-hosted CPU service. It is a microservice rather than in-browser so the check can't be bypassed from the client. ⚠️ The **model weights are licensed for non-commercial use only**: get a commercial licence or swap the model before paid launch. The service contract stays the same.
- **On-device quality check:** MediaPipe Face Detector (Apache-2.0), loaded from a CDN. It checks for one face, distance, a frontal pose, lighting, contrast and resolution. If the CDN fails, the server still enforces the hard checks.
- **Catalogue:** 40 original styles, 20 women's and 20 men's, including Indian salon staples such as the step cut, U-cut, V-cut, face-framing layers and curly tapers. Thumbnails are original procedural line art (`components/StyleArt.tsx`), so no third-party photos are used. Admins can attach **licensed** reference photos per style.
- **Analytics depth:** the dashboard shows credits against the plan, plus 30-day counts of sessions, looks, share rate (the >60% goal) and refunded looks. It also lists recent sessions, with no photos.

## Not done yet / next steps

- **Bake-off:** run 10 to 20 consenting Indian test faces through both providers. Score realism and likeness, then calibrate `IDENTITY_THRESHOLD`.
- Razorpay subscriptions. Pilots are invoiced manually for now, and admins top up credits in `/admin`.
- Rate limits are per serverless instance. If abuse appears, move them to Upstash or Postgres. Credits remain the hard limit either way.
- The phase-2 roadmap from the brief: hair colour, shorter/longer/volume adjustments, face-shape suggestions, salon custom styles (the schema already supports `styles.salon_id`), Hindi UI, booking integration and live AR.
- Legal review of `/privacy` and `/terms`, plus a signed DPA with each salon.
