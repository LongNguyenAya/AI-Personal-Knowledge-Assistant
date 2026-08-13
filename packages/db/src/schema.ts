import { pgTable, uuid, text, timestamp, vector, boolean, pgEnum, index, integer, uniqueIndex, pgPolicy, pgRole, jsonb } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// Provisioned by docker/initdb/01-roles.sql — .existing() references the role in policies
// without Drizzle trying to CREATE/DROP it itself.
export const appUserRole = pgRole("app_user").existing();

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const documentStatusEnum = pgEnum("document_status", ["uploaded", "processing", "processed", "failed"]);
export const reminderStatusEnum = pgEnum("reminder_status", ["pending", "sent"]);
export const reminderSourceEnum = pgEnum("reminder_source", ["manual", "ai_created"]);
export const chatRoleEnum = pgEnum("chat_role", ["user", "assistant", "system"]);
export const agentTypeEnum = pgEnum("agent_type", ["research", "action", "orchestrator", "pdf_extraction"]);

// Type suy ra từ enum — khai báo 1 lần ở đây, backend-service và frontend-app cùng import thay vì
// mỗi bên tự viết `(typeof xEnum.enumValues)[number]` riêng.
export type DocumentStatus = (typeof documentStatusEnum.enumValues)[number];
export type ReminderSource = (typeof reminderSourceEnum.enumValues)[number];
export type AgentType = (typeof agentTypeEnum.enumValues)[number];

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    role: roleEnum("role").notNull().default("user"),
    image: text("image"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  // Cho phân trang users ở admin/dashboard (ORDER BY created_at + LIMIT/OFFSET) — thiếu index
  // này Postgres phải quét và sort cả bảng mỗi lần, kể cả trang đầu tiên.
  (table) => [index("users_created_at_idx").on(table.createdAt)],
);

export const session = pgTable(
  "session",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  fileName: text("file_name").notNull(),
  status: documentStatusEnum("status").notNull().default("uploaded"),
  s3Key: text("s3_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Không có deletedAt — xoá tài liệu là hard delete, chunks tự xoá theo qua cascade FK.
}, (table) => ({
  userIdIdx: index("documents_user_id_idx").on(table.userId),
  userIsolationPolicy: pgPolicy("documents_user_isolation", {
    for: "all",
    to: appUserRole,
    using: sql`${table.userId} = current_setting('app.current_user_id')::uuid`,
    withCheck: sql`${table.userId} = current_setting('app.current_user_id')::uuid`,
  }),
})).enableRLS();

export const chunks = pgTable("chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  embedding: vector("embedding", { dimensions: 768 }), // 768 = số chiều embedding của model Gemini đang dùng, đổi model nhớ đổi theo
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  documentIdIdx: index("chunks_document_id_idx").on(table.documentId),
  // Index HNSW cho embedding phải tạo tay bằng raw SQL sau khi migrate — Drizzle chưa hỗ trợ cú
  // pháp này. Chunks không có user_id riêng nên policy phải join qua documents.
  userIsolationPolicy: pgPolicy("chunks_user_isolation", {
    for: "all",
    to: appUserRole,
    using: sql`exists (select 1 from documents d where d.id = ${table.documentId} and d.user_id = current_setting('app.current_user_id')::uuid)`,
    withCheck: sql`exists (select 1 from documents d where d.id = ${table.documentId} and d.user_id = current_setting('app.current_user_id')::uuid)`,
  }),
})).enableRLS();

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  isDone: boolean("is_done").default(false).notNull(),
  // 1 reminder có thể gắn nhiều task, không cần bảng trung gian. Reminder bị xoá thì gỡ liên
  // kết (set null), task vẫn giữ nguyên.
  //
  // Lưu ý: task.reminderId phải cùng userId với chính task — hiện chỉ được đảm bảo nhờ RLS, vì
  // nơi duy nhất ghi cột này (createReminder trong reminders.ts) luôn chạy trong
  // withUserContext(userId). RLS không áp dụng cho dbAdmin, nên nếu sau này có chỗ dùng dbAdmin
  // để set cột này, nhớ tự kiểm tra userId khớp — không thì tên task của người này có thể lọt
  // vào email/WebSocket của người khác qua attachTaskTitles().
  reminderId: uuid("reminder_id").references(() => reminders.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // .$onUpdate() bắt buộc phải có — analytics.ts dùng cột này làm mốc "tuần hoàn thành" (task
  // không có completedAt riêng). Thiếu .$onUpdate(), PATCH /api/tasks/[id] chỉ set isDone mà
  // không tự bump updatedAt (Postgres không tự làm việc này, defaultNow() chỉ áp dụng lúc INSERT),
  // khiến mọi task luôn bị tính vào tuần TẠO thay vì tuần HOÀN THÀNH.
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => /* @__PURE__ */ new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => ({
  // Không cần index riêng cho userId — composite bên dưới (userId, createdAt) đã bao luôn nhờ
  // tiền tố trái. Trang /tasks lọc userId rồi sort theo createdAt, nên composite cho Postgres
  // làm cả 2 việc trong 1 lần quét thay vì lọc xong mới sort riêng.
  userIdCreatedAtIdx: index("tasks_user_id_created_at_idx").on(table.userId, table.createdAt),
  // Scheduler quét theo reminderId mỗi phút (attachTaskTitles trong reminders.ts) — index này
  // cũng giúp onDelete:"set null" tìm nhanh các task phụ thuộc khi 1 reminder bị xoá.
  reminderIdIdx: index("tasks_reminder_id_idx").on(table.reminderId),
  userIsolationPolicy: pgPolicy("tasks_user_isolation", {
    for: "all",
    to: appUserRole,
    using: sql`${table.userId} = current_setting('app.current_user_id')::uuid`,
    withCheck: sql`${table.userId} = current_setting('app.current_user_id')::uuid`,
  }),
})).enableRLS();

export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("conversations_user_id_idx").on(table.userId),
  userIsolationPolicy: pgPolicy("conversations_user_isolation", {
    for: "all",
    to: appUserRole,
    using: sql`${table.userId} = current_setting('app.current_user_id')::uuid`,
    withCheck: sql`${table.userId} = current_setting('app.current_user_id')::uuid`,
  }),
})).enableRLS();

export const reminders = pgTable("reminders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  content: text("content"),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  status: reminderStatusEnum("status").notNull().default("pending"),
  source: reminderSourceEnum("source").notNull().default("manual"),
  emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Không có deletedAt — xoá reminder là hard delete. Cột cũ từng tồn tại nhưng không dùng ở
  // đâu, dễ gây hiểu lầm là reminders cũng soft-delete/khôi phục được như users/tasks.
}, (table) => ({
  // Không cần index riêng cho userId — đã nằm trong composite bên dưới.
  dueAtStatusIdx: index("reminders_due_at_status_idx").on(table.dueAt, table.status),
  // Cùng lý do với tasks_user_id_created_at_idx — trang /reminders lọc userId rồi sort createdAt.
  userIdCreatedAtIdx: index("reminders_user_id_created_at_idx").on(table.userId, table.createdAt),
  userIsolationPolicy: pgPolicy("reminders_user_isolation", {
    for: "all",
    to: appUserRole,
    using: sql`${table.userId} = current_setting('app.current_user_id')::uuid`,
    withCheck: sql`${table.userId} = current_setting('app.current_user_id')::uuid`,
  }),
})).enableRLS();

export const chatHistory = pgTable("chat_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  role: chatRoleEnum("role").notNull(),
  content: text("content").notNull(),
  // Kết quả tool call (vd createChart) đi kèm câu trả lời — text vẫn là nguồn chính, cột này chỉ
  // để phục dựng lại UI part (chart...) khi tải lại lịch sử hội thoại, thay vì chỉ còn mỗi chữ.
  // Nullable — tin nhắn thường (không gọi tool) không có gì để lưu ở đây.
  toolResults: jsonb("tool_results").$type<{ toolName: string; output: unknown }[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("chat_history_user_id_idx").on(table.userId),
  conversationIdIdx: index("chat_history_conversation_id_idx").on(table.conversationId),
  userIsolationPolicy: pgPolicy("chat_history_user_isolation", {
    for: "all",
    to: appUserRole,
    using: sql`${table.userId} = current_setting('app.current_user_id')::uuid`,
    withCheck: sql`${table.userId} = current_setting('app.current_user_id')::uuid`,
  }),
})).enableRLS();

export const adminAuditLog = pgTable("admin_audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminId: uuid("admin_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  targetUserId: uuid("target_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agentPrompts = pgTable("agent_prompts", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentType: agentTypeEnum("agent_type").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").default(true).notNull(),
  updatedBy: uuid("updated_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  agentTypeActiveIdx: index("agent_prompts_type_active_idx").on(table.agentType, table.isActive),
  onlyOneActivePerType: uniqueIndex("agent_prompts_one_active_per_type")
    .on(table.agentType)
    .where(sql`${table.isActive} = true`),
}));

export const userRelations = relations(users, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(users, {
    fields: [session.userId],
    references: [users.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(users, {
    fields: [account.userId],
    references: [users.id],
  }),
}));
