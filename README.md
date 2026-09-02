# AI Personal Knowledge Assistant

Trợ lý cá nhân: upload tài liệu, hỏi đáp có trích dẫn (RAG), tự tạo task/nhắc nhở qua chat, tự học từ những lần bạn sửa lưng nó, và có khu quản trị đầy đủ (settings động, duyệt kiến thức, audit log, dashboard xu hướng).

Tài liệu kỹ thuật chi tiết (kiến trúc, sơ đồ, giải thích từng kỹ thuật) và bản đồ chức năng-file nằm ở 2 tài liệu riêng — xem mục [Tài liệu thêm](#tài-liệu-thêm) cuối file này.

> **Đọc nhanh trong 5 phút?** Đọc "Tính năng chính" + "Kiến trúc tổng quan" ở đây là đủ hình dung tổng thể. Cần hiểu sâu 1 cơ chế cụ thể (vì sao làm vậy, chạy qua file nào) thì mới cần mở [Field Notes](#tài-liệu-thêm) hoặc [Feature Atlas](#tài-liệu-thêm).

## Tính năng chính

- **Chat với AI** có trích dẫn nguồn thật (research) hoặc gọi công cụ hành động (action) — tạo task, tạo nhắc nhở, vẽ biểu đồ số liệu, vẽ sơ đồ quy trình, tìm/đọc tài liệu.
- **Upload tài liệu** (.pdf, .docx, .pptx, .txt, .md, ảnh) — tự trích văn bản, tự phát hiện prompt injection và cảnh báo trích xuất thiếu.
- **Đính kèm tài liệu ngay trong lúc chat** — chọn tài liệu có sẵn hoặc upload mới, chờ xử lý xong tự hỏi luôn.
- **Tasks / Reminders** — tạo thủ công hoặc để AI tạo giúp, nhắc nhở tự đẩy qua WebSocket + email khi tới hạn.
- **Ghi chú AI (correction memory)** — hệ thống tự học khi bạn sửa lỗi nó, hoặc khi nó tự nhận ra tình huống mơ hồ (chờ bạn duyệt).
- **Tóm tắt hoạt động hàng tuần** qua email + trang riêng trong app.
- **Khu quản trị** (`/admin`): quản lý user, sửa system prompt từng loại agent, duyệt/thu hồi kiến thức global, cấu hình hệ thống động (không cần deploy lại), dashboard thống kê kèm phân tích xu hướng thật (hồi quy tuyến tính có kiểm định) + nhận định AI theo yêu cầu, audit log mọi thao tác admin.

## Kiến trúc tổng quan

Monorepo dùng npm workspaces, 2 service độc lập cùng nói chuyện với 1 Postgres:

```
                        ┌───────────────┐
                        │  Trình duyệt  │
                        └───┬───────┬───┘
                    HTTPS   │       │  WSS — thẳng tới EC2, không qua Render
                            ▼       ▼
                  ┌──────────────┐   ┌────────────────────┐
                  │    Render    │──▶│         EC2         │
                  │ frontend-app │   │   backend-service   │
                  │  (Next.js)   │   │ (Hono + LangGraph)  │
                  └──────┬───────┘   └──────────┬──────────┘
                         │   Drizzle (RLS)       │
                         └───────────┬───────────┘
                                     ▼
                            ┌─────────────────┐
                            │       Neon       │
                            │ Postgres+pgvector│
                            └─────────────────┘
```

`backend-service` còn nói chuyện riêng với **S3** (file gốc), **SQS** (2 hàng đợi: ingest tài liệu + trigger tóm tắt tuần), **EventBridge Scheduler** (cron), **Gemini + Groq**, và **Langfuse** (trace mọi lệnh gọi LLM) — không cái nào trong số này Render/frontend-app chạm tới trực tiếp.

```
frontend-app     Next.js App Router — toàn bộ UI + hầu hết route API (auth, CRUD, admin)
backend-service  Hono trên Node — HTTP API, WebSocket, agent/LangGraph, scheduler, 2 worker nền
packages/db            Schema Drizzle + client dùng chung cho cả 2 app
packages/shared-types  Kiểu dữ liệu dùng chung, SETTINGS_REGISTRY, hồi quy tuyến tính cho dashboard
```

## Tech stack

| Lớp | Công nghệ |
|---|---|
| Frontend | Next.js (App Router), React, Tailwind CSS, Vercel AI SDK (`useChat`) |
| Backend | Hono, Node.js, LangGraph (orchestrator agent) |
| Dữ liệu | PostgreSQL 16 + pgvector, Drizzle ORM |
| Xác thực | better-auth (frontend-app) + JWT EdDSA (cầu nối sang backend-service) |
| AI | Google Gemini (`gemini-flash-lite-latest`, `gemini-embedding-001`), Groq (xác minh trích dẫn) |
| Hạ tầng | AWS S3 (file), AWS SQS (hàng đợi xử lý nền), AWS EventBridge Scheduler (cron tuần) |
| Quan sát | Langfuse (trace mọi lệnh gọi LLM) |

## Công cụ AI dùng được trong chat

Action-agent tự chọn gọi tool nào dựa trên câu hỏi, không có luật cứng nào trong code ép buộc — mô tả tool là thứ duy nhất "dạy" nó khi nào nên dùng cái gì.

| Tool | Làm gì |
|---|---|
| `createTask` / `listTasks` | Tạo / liệt kê task |
| `createReminder` | Tạo nhắc nhở gắn giờ, có thể liên kết sẵn với task đã có |
| `searchDocuments` | Tìm đoạn liên quan trong tài liệu đã upload (RAG) |
| `readFullDocuments` | Đọc nguyên văn 1 tài liệu — dùng khi cần tóm tắt cả bài, không chỉ 1 đoạn |
| `createChart` | Tự truy vấn DB thật rồi vẽ biểu đồ, kèm tính xu hướng có kiểm định thống kê |
| `createDiagram` | Tự viết mã Mermaid vẽ sơ đồ quy trình nhiều bước/nhánh |
| `extractActionItems` | Quét 1 tài liệu tìm việc cần làm/deadline — chỉ đề xuất, không tự tạo reminder |
| `proposeKnowledgeNote` | Đề xuất 1 bài học *chung* để nhớ mãi mãi — chờ admin duyệt mới có hiệu lực |
| `noteObservation` | Tự ghi lại 1 tình huống mơ hồ vừa gặp — chờ chính user duyệt |

Riêng route "research" (câu hỏi tra cứu thuần, không cần hành động) không dùng tool nào ở trên — nó bị ép buộc trả lời qua `submitAnswer`, có 2 lớp kiểm tra thuần code để chặn bịa nguồn trước khi trả lời được chấp nhận.

## Quyết định thiết kế đáng chú ý

| Quyết định | Vì sao |
|---|---|
| Row-Level Security ở Postgres, không lọc `WHERE` trong code | Postgres tự chặn ở tầng row bất kể code có lỡ quên gì — an toàn hơn 1 lớp lọc application-level dễ quên |
| JWT ký bất đối xứng (EdDSA) giữa 2 service | backend-service chỉ *verify* được, không tự *tạo* token giả danh user nào — khác HMAC (khoá dùng chung, rủi ro cao hơn nếu 1 trong 2 service bị lộ) |
| 2 hệ thống trí nhớ tách biệt hoàn toàn (riêng-user vs global) | Trộn "AI tự học từ lỗi của 1 người" với "kiến thức áp dụng cho mọi người" sẽ rò ngữ cảnh riêng tư của người này sang người khác |
| Rate limit dùng fixed window, không token bucket/sliding log | Đơn giản, đủ cho mục tiêu "chặn spam thô" — đánh đổi: chấp nhận có thể burst nhẹ ở đúng ranh giới cửa sổ |
| Biểu đồ trong chat tự vẽ SVG tay, không dùng thư viện chart | Cần vẽ đúng hình dạng riêng (dải tin cậy dự đoán, đường trung bình trượt) mà thư viện có sẵn không hỗ trợ đúng ý |
| System prompt của agent lưu trong DB, không hardcode trong code | Admin sửa hành vi AI ngay qua `/admin/prompts`, không cần deploy lại |

## Bắt đầu chạy local

### Yêu cầu trước khi bắt đầu

Đây **không phải** dự án "npm install rồi chạy" đơn giản — `backend-service` từ chối khởi động nếu thiếu cấu hình AWS thật, và nhiều tính năng cần API key thật. Cần chuẩn bị trước:

- Node.js 24+, Docker (chạy Postgres local qua `docker-compose`).
- 1 bucket **S3** + 1 hàng đợi **SQS** trên AWS (bắt buộc, `backend-service` throw lỗi ngay lúc khởi động nếu thiếu).
- API key **Gemini** (`GEMINI_API_KEY`/`GOOGLE_API_KEY`/`GOOGLE_GENERATIVE_AI_API_KEY` — cùng 1 key, dùng ở 3 chỗ khác nhau trong code) và **Groq** (miễn phí, dùng để xác minh trích dẫn).
- Tài khoản **Langfuse** (miễn phí) lấy `LANGFUSE_SECRET_KEY`/`LANGFUSE_PUBLIC_KEY`.
- 1 tài khoản Gmail bật **App Password** để gửi email thật (xác nhận đăng ký, nhắc nhở, tóm tắt tuần).
- `EventBridge Scheduler` + hàng đợi SQS thứ 2 cho tóm tắt tuần là **tuỳ chọn** — thiếu `WEEKLY_DIGEST_QUEUE_URL` chỉ tắt tính năng đó, không chặn khởi động.

### Các bước

```bash
git clone <repo-url>
cd AIPersonalKnowledgeAssistantProject
npm install
```

**1. Postgres local:**

```bash
docker-compose up -d
```

**2. Biến môi trường** — copy 2 file mẫu rồi điền giá trị thật:

```bash
cp frontend-app/.env.example frontend-app/.env.local
cp backend-service/.env.example backend-service/.env
```

Sinh cặp khoá JWT (EdDSA/Ed25519) — dán nửa `JWT_PRIVATE_KEY` vào `frontend-app/.env.local`, nửa `JWT_PUBLIC_KEY` vào `backend-service/.env`:

```bash
cd frontend-app
node -e "import('jose').then(async ({generateKeyPair, exportJWK}) => { const {publicKey, privateKey} = await generateKeyPair('EdDSA', {crv: 'Ed25519', extractable: true}); console.log('JWT_PRIVATE_KEY=' + JSON.stringify(await exportJWK(privateKey))); console.log('JWT_PUBLIC_KEY=' + JSON.stringify(await exportJWK(publicKey))); });"
```

`BETTER_AUTH_SECRET` — 1 chuỗi ngẫu nhiên bất kỳ: `openssl rand -base64 32`.

**3. Migration** — tạo bảng + role + RLS policy trong Postgres local:

```bash
cd frontend-app
npx drizzle-kit migrate
```

> **Lưu ý đã biết:** lệnh trên từng bị treo (không rõ nguyên nhân) trên một số máy. Nếu bị treo, Ctrl+C rồi áp từng file migration thủ công theo đúng thứ tự bằng `psql`:
> ```bash
> for f in frontend-app/drizzle/migrations/*.sql; do psql "$DATABASE_MIGRATION_URL" -f "$f"; done
> ```

**4. Chạy dev** — 2 terminal riêng:

```bash
# Terminal 1
cd backend-service && npm run dev

# Terminal 2
cd frontend-app && npm run dev
```

Mở `http://localhost:3000`.

## Biến môi trường

Danh sách đầy đủ đã có sẵn trong 2 file `.env.example` (`frontend-app/`, `backend-service/`) kèm comment giải thích từng biến. Giải thích sâu hơn — biến nào bắt buộc, biến nào tuỳ chọn, vì sao — xem mục "Triển khai & hạ tầng" trong tài liệu Field Notes ở dưới.

## Cấu trúc thư mục

```
frontend-app/
  app/                  Route Next.js — trang (main)/, admin/, (auth)/, và route API
  components/           UI dùng chung + component riêng cho chat/admin
  lib/                  Helper phía server (auth, settings, db context...)
  drizzle/migrations/   Migration SQL, áp trực tiếp lên Postgres

backend-service/
  src/agents/           Orchestrator (LangGraph), tool cho AI, system prompt
  src/routes/           Route Hono (documents, orchestrator, ws, email)
  src/services/         Ingest tài liệu, gửi email, weekly digest, SQS
  src/workers/          2 worker nền (ingest tài liệu, digest tuần)
  src/scheduler/        Quét reminder tới hạn mỗi phút
  src/db/repositories/  Truy vấn DB, tách theo domain

packages/
  db/                   schema.ts (17 bảng) + client Drizzle
  shared-types/         Type dùng chung, SETTINGS_REGISTRY, hồi quy tuyến tính
```

## Triển khai production

frontend-app deploy trên Render, backend-service deploy bằng Docker (`Dockerfile` ở gốc repo) lên EC2, Postgres dùng Neon. `NEXT_PUBLIC_BACKEND_WS_URL` phải đổi từ `ws://localhost:4000` sang `wss://<domain-EC2-thật>` khi lên production. Chi tiết đầy đủ (vì sao 2 nhà cung cấp khác nhau, sơ đồ hạ tầng) — xem Field Notes.

## Phạm vi & giả định

- Thiết kế cho 1 cá nhân dùng, không phải SaaS nhiều tenant lớn — nhiều chỗ tối ưu cho "đúng và đơn giản" hơn là "chịu tải cao" (vd fixed window rate limit, WS registry trong RAM).
- Chưa có bộ test tự động end-to-end qua trình duyệt, cũng chưa có bộ eval cố định chạy lại được mỗi lần đổi code — phần lớn tính năng được kiểm chứng bằng script/DB thật ngay lúc code xong (throwaway, không giữ lại), không phải bằng 1 quy trình test lặp lại được.

## Giới hạn đã biết

- WebSocket registry sống trong RAM của 1 process — chưa hỗ trợ chạy nhiều instance backend-service cùng lúc, cần thêm Redis pub/sub hoặc tương tự nếu scale ngang.
- `/corrections`, `/digest`, `/settings` chưa được `middleware.ts` bảo vệ redirect ngay như `/chat`/`/documents`/`/tasks`/`/reminders` — chỉ được chặn ở tầng API, không redirect `/login` ngay lúc vào trang.
- `npx drizzle-kit migrate` từng bị treo trên một số máy, chưa rõ nguyên nhân gốc (xem cách xử lý ở mục "Bắt đầu chạy local").
- Danh sách đầy đủ hơn — xem mục "Vận hành & giới hạn đã biết" trong Field Notes.

## Tài liệu thêm

2 tài liệu tổng hợp kiến trúc/chức năng, dựng riêng để đọc nhanh hơn đọc code:

- **[Field Notes](https://claude.ai/code/artifact/4b060a61-a06c-4c93-afe5-99d4772e5639)** — giải thích kiến trúc, từng luồng xử lý, và các kỹ thuật đang dùng (vector search, LCS diff, hồi quy tuyến tính có kiểm định, JWT bất đối xứng...), kèm sơ đồ.
- **[Feature Atlas](https://claude.ai/code/artifact/bf518d3f-2f5f-4a91-bd92-8b9b26f5f157)** — tra cứu nhanh: 1 chức năng chạm file nào, workflow chạy theo thứ tự nào, có ô lọc theo tên/route/file.

> Cả 2 là trang riêng tư (chỉ bạn xem được trừ khi tự chia sẻ) — nếu sau này đưa repo này lên GitHub public, cân nhắc lại có muốn giữ 2 link này trong README hay không.
