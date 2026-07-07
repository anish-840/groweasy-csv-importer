# GrowEasy — AI-Powered CSV Importer

Upload **any** CSV — a Facebook/Google lead export, a real-estate CRM dump, a
marketing-agency sheet, or a hand-made spreadsheet — and let AI intelligently map
its arbitrary columns into the canonical **GrowEasy CRM** format.

> The hard part isn't parsing CSV. It's mapping *unknown, messy, differently-named*
> columns into a clean schema — reliably, at scale, and without losing data. This
> project solves that with careful prompt engineering, a deterministic validation
> layer, batched + streamed AI extraction, and a polished, responsive UI.

**Position applied for:** Software Developer (Full-Time)

| | |
|---|---|
| 🌐 **Live app** | _<add your Vercel URL here after deploying>_ |
| 🔌 **Live API** | _<add your Render/Railway URL here after deploying>_ |
| 📦 **Repository** | _<add your GitHub URL here>_ |

---

## Table of contents

- [Highlights](#highlights)
- [How it works](#how-it-works)
- [The AI extraction — prompt engineering](#the-ai-extraction--prompt-engineering)
- [CRM schema & rules](#crm-schema--rules)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [API reference](#api-reference)
- [Testing](#testing)
- [Docker](#docker)
- [Deployment](#deployment)
- [Design decisions & trade-offs](#design-decisions--trade-offs)
- [Bonus features checklist](#bonus-features-checklist)

---

## Highlights

- 🧠 **Intelligent field mapping** — infers meaning from headers *and* values, so
  `Contact`, `phone_number`, `Mobile No` and `Ph:` all resolve to the mobile field.
- 🔁 **Batched + streamed extraction** — rows are chunked, sent to the LLM in
  parallel batches with **retries + exponential backoff**, and results **stream
  back live** over NDJSON with real progress.
- 🛡️ **Deterministic validation layer** — the AI proposes; the backend *enforces*.
  Controlled vocabularies, date validity, phone/CC splitting, multi-email/phone
  handling, newline escaping and the skip rule are all applied in code, never left
  to chance.
- 🧯 **Always works — even with no API key** — a built-in heuristic engine maps
  columns deterministically, so the app is fully demoable offline. It also acts as
  a **per-batch fallback** if the AI fails after retries.
- 🎨 **Modern, responsive UI** — drag & drop, virtualized tables (sticky headers,
  H/V scroll) that stay smooth on huge CSVs, live progress, dark mode, CSV export.
- ✅ **Type-safe end to end** — one shared package defines the CRM contract for both
  the API and the web app. 38 unit/integration tests.

## How it works

```
 ┌─────────────┐   1. upload    ┌──────────────────────────────────────────┐
 │   Browser   │───────────────▶│  Next.js app (App Router, Tailwind)        │
 │             │                │  • drag & drop  • client-side CSV preview  │
 │             │◀───────────────│  • virtualized tables  • dark mode         │
 └─────────────┘   2. preview   └──────────────────────────────────────────┘
        │  3. Confirm  ──▶ POST /api/extract/stream  (multipart file)
        ▼
 ┌───────────────────────────────────────────────────────────────────────────┐
 │  Express API                                                                │
 │                                                                             │
 │  parseCsv ─▶ split into batches ─▶ [ Gemini provider ]  (retry + backoff)   │
 │                                          │  on failure ▼                    │
 │                                     [ heuristic fallback engine ]           │
 │                                          │                                  │
 │                                     post-process (validate / normalize)     │
 │                                          │                                  │
 │            stream NDJSON events ◀────────┘   start · batch · warning · done │
 └───────────────────────────────────────────────────────────────────────────┘
        │  4. live results
        ▼
 Imported records + skipped rows + summary  →  export as GrowEasy CRM CSV
```

The frontend parses the CSV **client-side purely for the preview** (no AI runs).
Only when the user clicks **Confirm** does it upload the file to the backend, which
is the authoritative parser + extractor.

## The AI extraction — prompt engineering

This is the heart of the project. The strategy is **"AI proposes, code disposes"**:
let the model do the fuzzy, semantic mapping it's good at, then enforce every
correctness-critical rule deterministically.

**1. A schema-derived system prompt.** The prompt
([`prompt.ts`](apps/api/src/services/extraction/prompt.ts)) is assembled from the
shared CRM schema, so the field list, descriptions and controlled vocabularies can
never drift from what the code validates against. It instructs the model to:
- infer column meaning from **headers *and* values** (a column of `9876543210`s is a
  phone even if titled `Contact`),
- output **one record per input row**, echoing a `_row` id for robust re-alignment,
- map free-text statuses/sources to the allowed enums (with explicit examples),
- normalize dates to `new Date()`-parseable ISO, split country code from number,
- move extra emails/phones and any leftover info into `crm_note`,
- keep every record a single CSV row (escape newlines as `\n`), and **never
  fabricate** data (blank when unknown).

**2. Structured output.** Gemini is called with `responseMimeType:
"application/json"` and a `responseSchema`, forcing valid, parseable JSON every
time. Temperature is `0` for determinism.

**3. Robust re-alignment.** Each input row carries a `_row` index that the model
echoes back, so results are matched to inputs even if the model reorders or drops
items (positional fallback if `_row` is missing).

**4. Deterministic post-processing** ([`postprocess.ts`](apps/api/src/services/extraction/postprocess.ts))
runs on **every** record regardless of engine:
- validates `crm_status` / `data_source` against the allowed sets (exact match →
  semantic keyword mapping → blank),
- keeps a date only if `new Date()` can parse it,
- splits `+91 98765 43210` into `country_code` (`+91`) and digits (`9876543210`),
- takes the **first** email/phone into its field and appends the rest to `crm_note`,
- escapes newlines so each record stays one valid CSV row,
- **skips** any row with neither an email nor a mobile number.

## CRM schema & rules

Target fields: `created_at, name, email, country_code,
mobile_without_country_code, company, city, state, country, lead_owner,
crm_status, crm_note, data_source, possession_time, description`.

- **`crm_status`** ∈ `GOOD_LEAD_FOLLOW_UP · DID_NOT_CONNECT · BAD_LEAD · SALE_DONE`
  (or blank).
- **`data_source`** ∈ `leads_on_demand · meridian_tower · eden_park · varah_swamy ·
  sarjapur_plots` (or blank if no confident match).
- **`created_at`** is always convertible via `new Date(created_at)`.
- Rows with **no email and no mobile** are skipped and reported separately.

The contract lives in one place: [`packages/shared/src/crm.ts`](packages/shared/src/crm.ts).

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | **Next.js 15** (App Router), **React 19**, **Tailwind CSS 3**, `@tanstack/react-virtual` |
| Backend | **Node.js 20**, **Express 4**, **PapaParse**, **Zod** |
| AI | **Google Gemini** (`@google/genai`, structured output) |
| Tooling | TypeScript (strict), **tsup**, **tsx**, **Vitest**, npm workspaces (monorepo) |

## Project structure

```
groweasy/
├── apps/
│   ├── api/                    # Express backend
│   │   └── src/
│   │       ├── services/
│   │       │   ├── csv.ts                     # CSV parsing
│   │       │   └── extraction/
│   │       │       ├── orchestrator.ts        # batching, concurrency, retry, streaming
│   │       │       ├── prompt.ts              # the system prompt (schema-derived)
│   │       │       ├── gemini.ts              # Gemini provider (structured output)
│   │       │       ├── fallback.ts            # deterministic heuristic engine
│   │       │       ├── postprocess.ts         # validation & normalization rules
│   │       │       └── provider.ts            # provider factory
│   │       ├── routes/         # /api/health, /api/extract, /api/extract/stream
│   │       ├── middleware/     # upload (multer), error handler
│   │       └── app.ts, index.ts, config.ts
│   └── web/                    # Next.js frontend
│       └── src/
│           ├── app/            # layout, page, globals.css
│           ├── components/     # Dropzone, DataTable (virtualized), steps/, ui/
│           ├── lib/            # api client (NDJSON stream), csv, export, utils
│           └── public/samples/ # example CSVs used by "Try a sample"
├── packages/
│   └── shared/                 # CRM schema, enums, Zod validators, shared types
├── docker-compose.yml
└── README.md
```

## Getting started

**Prerequisites:** Node.js ≥ 20 and npm ≥ 10.

```bash
# 1. Install all workspaces
npm install

# 2. Configure the backend (optional — omit the key to run in heuristic mode)
cp apps/api/.env.example apps/api/.env
#   then set GEMINI_API_KEY=...   (free key: https://aistudio.google.com/apikey)

# 3. (optional) point the web app at the API — defaults to http://localhost:8080
cp apps/web/.env.local.example apps/web/.env.local

# 4. Run both apps together
npm run dev
#   Web → http://localhost:3000     API → http://localhost:8080
```

Run them individually with `npm run dev:api` / `npm run dev:web`.

> **No Gemini key?** Everything still works: the app runs the deterministic
> heuristic engine and clearly labels the mode in the UI. Add a key anytime to
> switch to real AI extraction — no code changes.

## Environment variables

**Backend** (`apps/api/.env`)

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | _(empty)_ | Google Gemini key. Empty ⇒ heuristic fallback mode. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Model id (bump to a newer model freely). |
| `PORT` | `8080` | HTTP port. |
| `CORS_ORIGIN` | `*` | Allowed origin(s), comma-separated. Set to your web URL in prod. |
| `BATCH_SIZE` | `20` | Rows per AI request. |
| `BATCH_CONCURRENCY` | `3` | Batches processed in parallel. |
| `MAX_RETRIES` | `3` | AI retries per batch before falling back. |
| `MAX_ROWS` | `10000` | Safety cap on rows per upload. |
| `MAX_FILE_SIZE_MB` | `15` | Upload size limit. |
| `FORCE_FALLBACK` | `false` | Force heuristic mode even with a key (demos/tests). |

**Frontend** (`apps/web/.env.local`)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8080` | Backend base URL (inlined at build). |

## API reference

### `GET /api/health`
```json
{ "status": "ok", "aiEnabled": true, "model": "gemini-2.5-flash", "mode": "gemini" }
```

### `POST /api/extract`
Buffered extraction. Accepts either a multipart file (`file` field) **or** JSON
`{ "csv": "..." }`. Returns the full result:
```json
{
  "records": [ { "created_at": "...", "name": "John Doe", "email": "...", ... } ],
  "skipped": [ { "rowIndex": 2, "reason": "No email or mobile number found", "raw": { ... } } ],
  "summary": { "totalRows": 4, "imported": 3, "skipped": 1, "batches": 1,
               "source": "gemini", "usedFallback": false, "model": "gemini-2.5-flash",
               "durationMs": 812 }
}
```

### `POST /api/extract/stream`
Same input; streams **NDJSON** (one JSON event per line) for live progress:
```
{"type":"start","totalRows":40,"totalBatches":2,"source":"gemini","model":"gemini-2.5-flash"}
{"type":"batch","batchIndex":0,"records":[...],"skipped":[...],"source":"gemini","processedRows":20}
{"type":"warning","batchIndex":1,"message":"AI extraction failed for batch 2; used heuristic fallback."}
{"type":"done","summary":{...}}
```

Quick test:
```bash
curl -s -X POST localhost:8080/api/extract \
  -F file=@apps/web/public/samples/messy-agency.csv | jq .summary
```

## Testing

```bash
npm test            # all workspaces
npm run test:api    # backend only (Vitest + supertest)
npm run typecheck   # strict TypeScript across the monorepo
```

Coverage includes CSV parsing (quotes, embedded newlines, BOM, dedup), all
post-processing rules (phone/CC splitting, multi-email/phone, status mapping,
date validity, skip rule, newline escaping), the heuristic engine (header mapping
+ content recovery), and the HTTP endpoints (buffered, streaming, errors).

## Docker

```bash
GEMINI_API_KEY=your_key docker compose up --build
# Web → http://localhost:3000   API → http://localhost:8080
```

Individual images build from the **repo root** as context:
```bash
docker build -f apps/api/Dockerfile -t groweasy-api .
docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_BASE_URL=https://your-api .
```

## Deployment

The two apps deploy independently.

### Backend → Render (or Railway)
1. New **Web Service**, connect the repo (root directory = repo root).
2. **Build command:** `npm ci && npm run build:api`
3. **Start command:** `npm run start:api`
4. **Health check path:** `/api/health`
5. **Environment:** `GEMINI_API_KEY`, `GEMINI_MODEL`, and
   `CORS_ORIGIN=https://<your-vercel-app>.vercel.app`.
   (Render provides `PORT` automatically.)

_Or_ deploy the provided `apps/api/Dockerfile`.

### Frontend → Vercel
1. Import the repo; set **Root Directory** to `apps/web` (Vercel detects the npm
   workspace and installs from the repo root).
2. **Environment variable:** `NEXT_PUBLIC_API_BASE_URL=https://<your-api-host>`
   (set for Production/Preview — it is inlined at build time).
3. Deploy. Then make sure the API's `CORS_ORIGIN` allows your Vercel domain.

## Design decisions & trade-offs

- **AI proposes, code disposes.** LLMs are great at fuzzy mapping but shouldn't be
  trusted with hard rules. Enums, dates, phone splitting and the skip rule are
  enforced deterministically so results are correct even if the model is imperfect.
- **Streaming over NDJSON (not SSE).** NDJSON over a `fetch` `ReadableStream` works
  cleanly with a `POST` + file upload and needs no extra protocol — the client just
  reads lines. This powers real progress and partial results.
- **Per-batch fallback.** If the AI fails a batch after retries, that batch is mapped
  by the heuristic engine instead of failing the whole import — resilient by design.
- **Monorepo with a shared contract.** One `@groweasy/shared` package keeps the CRM
  schema, enums and types identical on both sides — no drift, full type safety.
- **`main` → TS source for `shared`.** Consumed via `transpilePackages` (web) and
  bundled by `tsup` (api), so there's no separate build step and deploys stay simple.

## Bonus features checklist

- [x] Drag & drop upload (+ file picker, + "Try a sample")
- [x] Progress indicators during AI processing (live, per-batch)
- [x] Streaming / incremental results (NDJSON)
- [x] Retry mechanism for failed AI batches (exponential backoff + heuristic fallback)
- [x] Virtualized tables for large CSVs (sticky headers, H/V scroll)
- [x] Dark mode (system-aware, no flash)
- [x] Unit tests (38, backend + frontend)
- [x] Docker setup (Dockerfiles + docker-compose)
- [x] Deployment-ready (Vercel + Render/Railway) with standalone Next output
- [x] Well-written README
- [x] Export imported leads as GrowEasy CRM CSV

---

Built for the GrowEasy assignment. MIT licensed.
