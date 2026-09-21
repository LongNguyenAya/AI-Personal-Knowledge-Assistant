# AI Personal Knowledge Assistant

A personal assistant: upload documents, ask questions with real citations (RAG), automatically create tasks/reminders through chat, learn from the corrections you make, and a full admin area (dynamic settings, knowledge review, audit log, trend dashboard).

> **Deployed app**: https://ai-personal-knowledge-assistant.onrender.com/

## Key features

- **Chat with AI**: Answers with real source citations (research) or calls action tools (action), create a task, create a reminder, draw a data chart, draw a process diagram, search/read documents.
- **Document upload**: Supports .pdf, .docx, .pptx, .txt, .md, and images; extracts text automatically, detects prompt injection, and flags likely incomplete extraction.
- **Attach a document right in chat**: Pick an existing document or upload a new one, the question is asked automatically once processing finishes.
- **Tasks / Reminders**: Create manually or let the AI create them for you, reminders push through WebSocket + email when they're due.
- **AI Notes (correction memory)**: The system learns automatically when you correct it, or when it notices an ambiguous situation on its own (pending your approval).
- **Weekly activity digest**: Delivered by email + a dedicated page in the app.
- **Admin area** (`/admin`): Manage users, edit each agent's system prompt, approve/revoke global knowledge, dynamic system configuration (no redeploy needed), a stats dashboard with real trend analysis (linear regression with significance testing) plus on-demand AI commentary, an audit log of every admin action.

## Architecture overview

A monorepo using npm workspaces, 2 independent services both talking to 1 Postgres:

```
                        ┌───────────────┐
                        │    Browser    │
                        └───┬───────┬───┘
                    HTTPS   │       │  WSS, straight to EC2, not through Render
                            ▼       ▼
                  ┌──────────────┐    ┌────────────────────┐
                  │    Render    │──> │         EC2        │
                  │ frontend-app │    │   backend-service  │
                  │  (Next.js)   │    │ (Hono + LangGraph) │
                  └──────┬───────┘    └──────────┬─────────┘
                         │   Drizzle (RLS)       │
                         └───────────┬───────────┘
                                     ▼
                            ┌──────────────────┐
                            │       Neon       │
                            │ Postgres+pgvector│
                            └──────────────────┘
```

`backend-service` also talks directly to **S3** (raw files), **SQS** (2 queues: document ingestion + weekly digest trigger), **EventBridge Scheduler** (cron), **Gemini + Groq**, and **Langfuse** (traces every LLM call). None of these are ever touched directly by Render/frontend-app.

```
frontend-app     Next.js App Router, all UI + most API routes (auth, CRUD, admin)
backend-service  Hono on Node, HTTP API, WebSocket, agent/LangGraph, scheduler, 2 background workers
packages/db            Drizzle schema + client shared by both apps
packages/shared-types  Shared types, SETTINGS_REGISTRY, linear regression for the dashboard
```

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), React, Tailwind CSS, Vercel AI SDK (`useChat`) |
| Backend | Hono, Node.js, LangGraph (orchestrator agent) |
| Data | PostgreSQL 16 + pgvector, Drizzle ORM |
| Auth | better-auth (frontend-app) + JWT EdDSA (bridge to backend-service) |
| AI | Google Gemini (`gemini-flash-lite-latest`, `gemini-embedding-001`), Groq (citation verification) |
| Infra | AWS S3 (files), AWS SQS (background processing queues), AWS EventBridge Scheduler (weekly cron) |
| Observability | Langfuse (traces every LLM call) |

## AI tools available in chat

The action-agent picks which tool to call based on the question itself, with no hardcoded rule forcing it. The tool's description is the only thing "teaching" it when to use what.

| Tool | What it does |
|---|---|
| `createTask` / `listTasks` | Create / list tasks |
| `createReminder` | Create a time-bound reminder, optionally linked to an existing task |
| `searchDocuments` | Find relevant excerpts in uploaded documents (RAG) |
| `readFullDocuments` | Read a document in full, used when summarizing the whole thing, not just an excerpt |
| `createChart` | Query the real DB and draw a chart, with statistically-tested trend detection |
| `createDiagram` | Write Mermaid code to draw a multi-step/branching process diagram, self-corrects on invalid syntax before returning (see "Agent harness" below) |
| `extractActionItems` | Scan a document for action items/deadlines, only suggests, never creates a reminder on its own |
| `proposeKnowledgeNote` | Propose a *general* lesson to remember forever, only takes effect after admin approval |
| `noteObservation` | Record an ambiguous situation it just ran into, waits for the user's own approval |
| `queryKnowledgeGraph` | Find a connection between 2 named entities mentioned across different documents that never reference each other directly, entities are merged and linked at ingest time (see "Agent harness" below) |

The "research" route (pure lookup questions, no action needed) doesn't use any of the tools above. It's forced to answer through `submitAnswer`, which has 2 pure-code checks to block a fabricated source before an answer is accepted.

## Agent harness & evals

Self-correction lives in the tools themselves, not just in the prompt asking nicely: `createDiagram` parses its own Mermaid output before returning it, and on a syntax error hands the parser's message back to the model to fix and retry in the same turn; `searchDocuments`/`listTasks` return an extra field (`hasAnyDocuments`/`totalTaskCountIgnoringFilters`) so the model can tell apart "genuinely nothing exists" from "results got filtered out" instead of guessing.

Behavior is measured with 7 eval scripts (`npm run eval:router` / `eval:grounding` / `eval:quote-verification` / `eval:action-consistency` / `eval:chart-narration` / `eval:diagram-grounding` / `eval:kg-grounding`), each grading a real tool call against a known answer, 2 of them using a separate model (Groq) as an independent judge. A live Groq-judge gate was considered for `queryKnowledgeGraph` (block a connection before showing it, if a second model can't confirm it's meaningful) and rejected: "is this connection meaningful" has no objective check, so it would be the first gate in the codebase using 1 uncertain model to police another, instead the risk is measured with `eval:kg-grounding` and blocked in code where it can be (a generic/common-noun entity can never act as a bridge between 2 others). Every run rewrites its own section of `backend-service/docs/EVAL_RESULTS.md`, so the numbers there can't go stale from someone forgetting to update a doc by hand. Design rationale (why only some tools got this, why some evals grade per-claim instead of pass/fail) is in `backend-service/docs/HARNESS_NOTES.md`.

## Techniques applied

| Technique | Purpose |
|---|---|
| Row-Level Security in Postgres, not a `WHERE` filter in code | Postgres blocks at the row level regardless of anything code might forget, safer than an application-level filter that's easy to miss |
| Asymmetric JWT signing (EdDSA) between the 2 services | backend-service can only *verify*, never *create*, a token impersonating any user, unlike HMAC (a shared key, higher risk if either service is compromised) |
| 2 fully separate memory systems (per-user vs global) | Mixing "the AI learns from 1 person's mistakes" with "knowledge that applies to everyone" would leak one person's private context into another's |
| Rate limiting via a fixed window, not a token bucket/sliding log | Simple, enough for the goal of "block crude spam". The trade-off is accepting a small burst right at the window boundary |
| Charts in chat are hand-drawn SVG, no charting library | Needed to draw shapes a stock library doesn't support well (a forecast confidence band, a moving-average line) |
| Agent system prompts live in the DB, not hardcoded | Admin changes AI behavior directly via `/admin/prompts`, no redeploy needed |
| Self-correction where a cheap objective check exists, not everywhere | Adding a retry loop only pays off where correctness is checkable by code (Mermaid syntax); tools whose correctness is semantic or meant to be human-reviewed don't get one, see `backend-service/docs/HARNESS_NOTES.md` |

## Database

`packages/db/src/schema.ts` is the single Drizzle schema, shared by both `frontend-app` and `backend-service`, neither service defines its own tables. Currently 17 tables, migrations live in `frontend-app/drizzle/migrations/` (generated and applied with `drizzle-kit`).

**2 Postgres roles, no `WHERE user_id = ...` filtering in code:**

| Role | Used for | How it works |
|---|---|---|
| `app_user` | Every normal user request | RLS filters automatically by `current_setting('app.current_user_id')`, set via `withUserContext()` at the start of each transaction |
| `admin_user` | Admin actions (`/admin/*`) | `BYPASSRLS`, can read/write every user's data |

8 of 17 tables have RLS enabled (`documents`, `chunks`, `tasks`, `conversations`, `reminders`, `chat_history`, `user_correction_memories`, `weekly_digests`), each with a `pgPolicy` matching `user_id` against `current_setting`. The other 9 tables don't have RLS since they're shared/global data: better-auth's own tables (`users`, `session`, `account`, `verification`), or data only admins touch (`admin_audit_log`, `agent_prompts`, `knowledge_files`, `admin_chart_analyses`, `system_settings`).

`chunks.embedding` uses the `vector` type (pgvector). Relevant excerpts for RAG are found by cosine distance, not ordinary full-text search.

## Running locally

### Prerequisites

Since `backend-service` refuses to start without real AWS configuration, and many features need real API keys, prepare these first:

- Node.js 24+, Docker (runs Postgres locally via `docker-compose`).
- 1 **S3** bucket + 1 **SQS** queue on AWS (required, `backend-service` throws immediately at startup if missing).
- A **Gemini** API key (`GEMINI_API_KEY`/`GOOGLE_API_KEY`/`GOOGLE_GENERATIVE_AI_API_KEY`, the same key, used in 3 different places in the code) and a **Groq** key (free, used for citation verification).
- A **Langfuse** account (free) for `LANGFUSE_SECRET_KEY`/`LANGFUSE_PUBLIC_KEY`.
- A Gmail account with an **App Password** enabled, to send real email (signup confirmation, reminders, weekly digest).
- `EventBridge Scheduler` + a second SQS queue for the weekly digest are **optional**. Missing `WEEKLY_DIGEST_QUEUE_URL` just disables that feature, it doesn't block startup.

### Steps

```bash
git clone <repo-url>
cd AIPersonalKnowledgeAssistantProject
npm install
```

**1. Local Postgres:**

```bash
docker-compose up -d
```

**2. Environment variables**, copy the 2 example files and fill in real values:

```bash
cp frontend-app/.env.example frontend-app/.env.local
cp backend-service/.env.example backend-service/.env
```

Generate a JWT key pair (EdDSA/Ed25519), paste the `JWT_PRIVATE_KEY` half into `frontend-app/.env.local`, the `JWT_PUBLIC_KEY` half into `backend-service/.env`:

```bash
cd frontend-app
node -e "import('jose').then(async ({generateKeyPair, exportJWK}) => { const {publicKey, privateKey} = await generateKeyPair('EdDSA', {crv: 'Ed25519', extractable: true}); console.log('JWT_PRIVATE_KEY=' + JSON.stringify(await exportJWK(privateKey))); console.log('JWT_PUBLIC_KEY=' + JSON.stringify(await exportJWK(publicKey))); });"
```

`BETTER_AUTH_SECRET`, any random string: `openssl rand -base64 32`.

**3. Migrations**, creates tables + roles + RLS policies in local Postgres:

```bash
cd frontend-app
npx drizzle-kit migrate
```

> **Note:** this command has hung before (root cause unclear). If it hangs, Ctrl+C and apply each migration file manually in order with `psql`:
> ```bash
> for f in frontend-app/drizzle/migrations/*.sql; do psql "$DATABASE_MIGRATION_URL" -f "$f"; done
> ```

**4. Run dev**, 2 separate terminals:

```bash
# Terminal 1
cd backend-service && npm run dev

# Terminal 2
cd frontend-app && npm run dev
```

Open `http://localhost:3000`.

## Environment variables

The full list already lives in the 2 `.env.example` files (`frontend-app/`, `backend-service/`) with a comment explaining each variable. For a deeper explanation, which are required, which are optional, and why, see the "Deployment & infrastructure" section of the Field Notes document mentioned below.

## Directory structure

```
frontend-app/
  app/                  Next.js routes, (main)/, admin/, (auth)/ pages, and API routes
  components/           Shared UI + components specific to chat/admin
  lib/                  Server-side helpers (auth, settings, db context...)
  drizzle/migrations/   Migration SQL, applied directly to Postgres

backend-service/
  src/agents/           Orchestrator (LangGraph), AI tools, system prompts
  src/routes/           Hono routes (documents, orchestrator, ws, email)
  src/services/         Document ingestion, sending email, weekly digest, SQS
  src/workers/          2 background workers (document ingestion, weekly digest)
  src/scheduler/        Scans for due reminders every minute
  src/db/repositories/  DB queries, split by domain

packages/
  db/                   schema.ts (17 tables) + Drizzle client
  shared-types/         Shared types, SETTINGS_REGISTRY, linear regression
```

## Production deployment

frontend-app deploys on Render, backend-service deploys via Docker (`Dockerfile` at the repo root) to EC2, Postgres runs on Neon. `NEXT_PUBLIC_BACKEND_WS_URL` has to switch from `ws://localhost:4000` to `wss://<real-EC2-domain>` in production.

## Scope & assumptions

- Designed for 1 individual user, not a large multi-tenant SaaS. Because of that, several places optimize for "correct and simple" over "handles heavy load" (e.g. fixed-window rate limiting, the WS registry living in RAM).
- No automated end-to-end browser test suite yet, and the 7 eval scripts (see "Agent harness & evals") are run by hand, not wired into CI, so a regression only gets caught if someone remembers to rerun them. Sample sizes per eval are small (1 to 15 cases), enough to catch a clear break, not enough to claim tight statistical confidence.

## Known limitations

- The WebSocket registry lives in the RAM of 1 process, running multiple backend-service instances at once isn't supported yet. A Redis pub/sub fix for this was built and tested on a separate branch (`experiment/redis-ws-registry`, not merged into `master`), see the note below. Not merged into production since current traffic doesn't need horizontal scaling yet.
- `/corrections`, `/digest`, `/settings` aren't protected by an immediate redirect in `middleware.ts` the way `/chat`/`/documents`/`/tasks`/`/reminders` are, they're only blocked at the API layer, without an immediate redirect to `/login` on page load.

## Self-hosting & concurrency exploration

Separate from this app's real architecture, self-hosting an LLM (Qwen2.5-1.5B-Instruct-AWQ, served locally with vLLM) was used as a hands-on exercise to explore concurrency concepts that don't come up when just calling a hosted API. Continuous batching and its effect on throughput (measured with concurrent `curl` benchmarks), and the GPU KV cache as the real, VRAM-dependent limit on how many requests can run at once, rather than a fixed constant.

That exercise led directly into testing horizontal scaling for `backend-service` itself: running 2 instances side by side surfaced the exact WebSocket registry limitation noted above, which the Redis pub/sub branch was built to fix. Testing that fix by deliberately killing Redis mid-request also surfaced a real finding, the API reports a message as sent even when it hasn't reached the client yet, since `ioredis` queues commands locally instead of failing immediately when the connection is down; the message arrives once Redis recovers, so it's delayed rather than lost, but the API response doesn't reflect that.

None of this self-hosted setup is part of the deployed application, it's exploratory work kept off `master`, done purely to build real understanding of concurrency and horizontal-scaling trade-offs.
