# Try-Before-You-Cut

**See the cut before the scissors.** Try-Before-You-Cut is an AI hair-consultation app for salons. A customer gives consent, takes one photo and picks up to four styles. Realistic 2K previews of those cuts come back on their own face. The customer compares each one with a before/after slider and leaves with a Stylist Board, branded with the salon, sent to their WhatsApp.

- **You (platform admin)** create salons, give each one a username and password, and decide how many photos (looks) it can generate.
- **Salons** sign in, run consultations on a tablet or share a link/QR with customers, brand their boards, and manage their own staff logins.
- **Customers** never sign up or pay.

| | |
| --- | --- |
| Image generation | **Magnific MCP**: Nano Banana 2.1, 2K, 3:4 portrait |
| Checks (one face, same person, style applied) | **OpenAI-compatible LLM**: OpenRouter `qwen/qwen3.8-omni-flash` |
| Data | PostgreSQL + private files on your server's disk |
| Hosting | Your VPS with Docker Compose; Caddy gets HTTPS for your domain automatically |

> The name "Try-Before-You-Cut" is a common phrase, which may make it hard to register as a trademark. Check at [ipindia.gov.in](https://ipindia.gov.in) before you print anything.

## Deploy on your VPS (about 10 minutes)

You need: a VPS (Ubuntu 22.04/24.04, 2 GB RAM or more), your domain, a Magnific MCP token and an OpenRouter API key.

1. **Point your domain at the VPS.** In your DNS, add an `A` record for `tryon.yourdomain.com` (or the bare domain) pointing to the VPS IP. Add a `www` record too if you use it.
2. **Install Docker** on the VPS:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
3. **Get the code and configure it:**
   ```bash
   git clone https://github.com/radhakrishnanp-lgtm/Try-Before-You-Cut.git
   cd Try-Before-You-Cut
   cp .env.example .env
   nano .env
   ```
   Fill in at least these:
   | Setting | What to put |
   | --- | --- |
   | `DOMAIN` | `tryon.yourdomain.com` |
   | `APP_SECRET` | output of `openssl rand -base64 48` |
   | `POSTGRES_PASSWORD` | output of `openssl rand -hex 24` |
   | `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` | your admin login. Make the hash with `docker run --rm -v "$PWD/scripts:/s" node:22-slim node /s/hash-password.mjs 'your-password'` (or set `ADMIN_PASSWORD` to start with) |
   | `MAGNIFIC_MCP_TOKEN` | your Magnific MCP token |
   | `LLM_API_KEY` | your OpenRouter key |
   | `GRIEVANCE_EMAIL` | the privacy contact shown to customers |
4. **Start it:**
   ```bash
   docker compose up -d --build
   docker compose logs -f app      # wait for "database ready"
   ```
   Open `https://tryon.yourdomain.com`. Caddy gets the certificate on the first visit, which can take a few seconds. Ports 80 and 443 must be open in the VPS firewall.
5. **Check the connections.** Sign in at `/login` with your admin username, open **Connections** and press **Run free checks**. All four checks should show OK. Then press **Check** on *Magnific test image*, which uses a few credits.
6. **Add your first salon.** Open **New salon** and enter the salon name, its link name, the number of looks, and the owner's username and password. Copy the login details and send them to the owner privately.

**Updating** later: `git pull && docker compose up -d --build`. Database changes run automatically at startup.

**Backups:** the `pgdata` volume holds the database and the `storage` volume holds photos (24 h only) and logos. Back up the database daily, for example:
```bash
docker compose exec -T db pg_dump -U tbyc tbyc | gzip > backup-$(date +%F).sql.gz
```

## Credits

- Each salon has a credit balance. **One generated look = `CREDITS_PER_IMAGE` credits (default 10).**
- In **Admin → Salons** you add or remove looks (converted to credits), pause a salon, reset logins, and open its dashboard or studio.
- Credits are reserved before generating. A salon can never go below zero: if 4 styles are picked with 3 looks left, the app says so and asks for fewer.
- Looks that fail are refunded automatically: a generation error, a changed face, or a style that wasn't applied.
- Note that a look that needs the automatic retry costs you two Magnific generations but is charged to the salon once. Set `CREDITS_PER_IMAGE` with that margin in mind.

## Logins

| Who | How they get in | What they can do |
| --- | --- | --- |
| Platform admin (you) | `ADMIN_USERNAME` + password from `.env` | Create, pause and top up salons; reset any password; edit the style catalogue; run connection checks; open any salon's dashboard or studio |
| Salon owner | Username + password you create | Dashboard: balance, usage, QR link, branding (logo, colour, booking link, WhatsApp), visible styles, staff logins |
| Stylist | Username + password the owner creates | Run consultations in `/studio`; see the overview |

Details:
- Passwords are hashed with scrypt.
- Sessions use a signed, httpOnly cookie that lasts 14 days. Changing a password signs that person out everywhere.
- Login attempts are rate-limited per IP and per username.

## How a consultation works

```
Customer / stylist                         Server (your VPS)                                   Services
──────────────────                         ─────────────────                                   ────────
consent screen ── POST /api/sessions ───── consent ledger (DPDP), session token
photo ─ resize + on-device check ─ POST /photo ── one face? ─────────────────────────────────── LLM vision (Qwen)
                                           saved privately on disk
pick ≤4 styles ── POST /rounds ─────────── reserve credits (looks × 10, atomic)
                                           Magnific: per-session folder + upload photo once ─── Magnific MCP
  ┌ POST /results/a/run ┐ in parallel      images_generate (Nano Banana 2.1, 2K, 3:4) ───────── Magnific MCP
  ├ POST /results/b/run ┤ each card fills  check: same person? style applied? ───────────────── LLM vision (Qwen)
  └ …                   ┘ as it's ready    fails → one strict retry → hide + refund
compare · download · Stylist Board ── WhatsApp / share sheet / 24h link
every 15 min ──────────────────────────── delete expired photos/results + trash Magnific folders
```

## Configuration reference

Everything lives in `.env`; see `.env.example` for the full list with comments. The main settings:

| Setting | Default | Notes |
| --- | --- | --- |
| `MAGNIFIC_IMAGE_MODEL` | `imagen-nano-banana-2-1` | Any slug from Magnific's `images_models_list` |
| `MAGNIFIC_RESOLUTION` | `2k` | `1k`, `2k`, `4k` (higher costs more) |
| `MAGNIFIC_ASPECT_RATIO` | `3:4` | Portrait. `auto` keeps each photo's shape |
| `LLM_MODEL` | `qwen/qwen3.8-omni-flash` | Must accept images |
| `LLM_IDENTITY_THRESHOLD` | `0.75` | Likeness the check must report to show a look |
| `CREDITS_PER_IMAGE` | `10` | |
| `AI_PROVIDERS` | `magnific` | Add `gemini` or `flux` as fallbacks (with their keys) |
| `FACE_SERVICE_URL` | | Optional stricter face check (`services/face-embed`) |

## Privacy (India DPDP Act 2023 and Rules 2025)

- An explicit consent screen comes before any photo. It covers purpose, retention, withdrawal and the grievance contact. Under-18s need guardian consent.
- The consent ledger keeps a timestamp, the notice version, a hash of the notice text and a hashed IP.
- Photos, previews and notes are **deleted 24 hours** after the session starts. A customer can also press "Delete my data now". The matching Magnific folder is moved to trash at the same time.
- Files are stored privately on your server and served only through short-lived signed links.
- Every result is labelled AI-generated with an "actual results may vary" disclaimer, including the downloads and the Stylist Board.
- The access log is kept for 1 year.
- `/privacy` and `/terms` are drafts. **Have them reviewed by a lawyer** and sign a data-processing agreement with each salon.

## Develop locally

```bash
npm install
npm run dev                 # http://localhost:3000 in DEMO mode (no database needed)
```

Without `DATABASE_URL` the app runs in demo mode:
- Data is kept in memory, with a seeded salon at `/t/demo`.
- Demo logins: `demo-owner` / `tryitnow`, `demo-stylist` / `tryitnow`, `admin` / `admin1234`.
- Previews are mock images unless you set the Magnific and LLM keys.

```bash
npm test                    # unit tests
npm run typecheck && npm run build
# Browser walkthroughs (Playwright), against a running server:
node tests/e2e/demo-flow.mjs out http://localhost:3000     # customer flow (demo mode)
node tests/e2e/salon-flow.mjs out http://localhost:3000    # admin/salon/credits flow (database mode)
# Full pipeline without spending credits: fake Magnific MCP + fake LLM on :4010/:4011
node tests/e2e/fake-services.mjs
```

## Code map

| Path | What |
| --- | --- |
| `src/components/tryon/` | Customer flow: consent, capture, style picker, results, compare, Stylist Board |
| `src/components/fx/` | 3D tilt + glare, cursor spotlight, 3D hero |
| `src/app/admin`, `src/app/dashboard` | Platform admin and salon dashboards |
| `src/lib/sessions.ts` | Consultation logic: photo checks, credits, generation, retries, erasure |
| `src/lib/ai/magnific.ts`, `src/lib/mcp/` | Magnific MCP adapter, MCP client, TOON parser |
| `src/lib/llm.ts`, `src/lib/identity/` | OpenAI-compatible client and the vision checks |
| `src/lib/auth.ts`, `src/lib/password.ts` | Logins and sessions |
| `src/lib/db/`, `src/lib/store/` | Migrations (run at startup) and the Postgres / in-memory stores |
| `src/instrumentation.ts` | Starts migrations and the cleanup timer when the server boots |
