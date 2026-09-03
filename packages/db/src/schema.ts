import { pgTable, uuid, text, timestamp, vector, boolean, pgEnum, index, integer, uniqueIndex, pgPolicy, pgRole, jsonb } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// Provisioned by docker/initdb/01-roles.sql, .existing() tránh Drizzle tự CREATE/DROP role này.
export const appUserRole = pgRole("app_user").existing();

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const documentStatusEnum = pgEnum("document_status", ["uploaded", "processing", "processed", "failed"]);
export const reminderStatusEnum = pgEnum("reminder_status", ["pending", "sent"]);
export const reminderSourceEnum = pgEnum("reminder_source", ["manual", "ai_created"]);
export const chatRoleEnum = pgEnum("chat_role", ["user", "assistant", "system"]);
export const agentTypeEnum = pgEnum("agent_type", ["research", "action", "orchestrator", "pdf_extraction", "image_extraction"]);
export const knowledgeStatusEnum = pgEnum("knowledge_status", ["pending", "approved", "rejected", "revoked"]);
export const correctionStatusEnum = pgEnum("correction_status", ["active", "inactive", "dismissed", "expired"]);

// Type suy ra từ enum, khai báo 1 lần để cả 2 app cùng import.
export type DocumentStatus = (typeof documentStatusEnum.enumValues)[number];
export type ReminderSource = (typeof reminderSourceEnum.enumValues)[number];
export type AgentType = (typeof agentTypeEnum.enumValues)[number];
export type KnowledgeStatus = (typeof knowledgeStatusEnum.enumValues)[number];
export type CorrectionStatus = (typeof correctionStatusEnum.enumValues)[number];

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
    // User tự viết 1 lần, luôn đưa vào mọi prompt action-agent, chỉnh ở /settings.
    personalNote: text("personal_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  // Cho phân trang users ở admin, thiếu index này Postgres phải quét/sort cả bảng mỗi lần.
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
  // Quét 1 lần lúc ingest, không chặn xử lý, chỉ đánh dấu cảnh báo và ép hạ confidence.
  flaggedSuspicious: boolean("flagged_suspicious").notNull().default(false),
  flagReason: text("flag_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // Không có deletedAt, xoá tài liệu là hard delete, chunks tự xoá theo qua cascade FK.
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
  // Index HNSW phải tạo tay bằng raw SQL, Drizzle chưa hỗ trợ. Policy RLS phải join qua documents.
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
  // 1 reminder gắn nhiều task, reminderId khớp userId chỉ được RLS đảm bảo, dbAdmin phải tự kiểm tra.
  reminderId: uuid("reminder_id").references(() => reminders.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // .$onUpdate() bắt buộc, analytics.ts dùng cột này làm mốc "tuần hoàn thành", task không có completedAt riêng.
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => /* @__PURE__ */ new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => ({
  // Không cần index riêng cho userId, composite (userId, createdAt) đã bao nhờ tiền tố trái.
  userIdCreatedAtIdx: index("tasks_user_id_created_at_idx").on(table.userId, table.createdAt),
  // Scheduler quét theo reminderId mỗi phút, index này cũng giúp tìm nhanh task khi xoá reminder.
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
  // Không có deletedAt, xoá reminder là hard delete, khác users/tasks (soft-delete).
}, (table) => ({
  // Không cần index riêng cho userId, đã nằm trong composite bên dưới.
  dueAtStatusIdx: index("reminders_due_at_status_idx").on(table.dueAt, table.status),
  // Cùng lý do với tasks_user_id_created_at_idx, trang /reminders lọc userId rồi sort createdAt.
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
  // Lưu kèm tool call để phục dựng UI part (chart...) và hiện trace khi tải lại lịch sử.
  toolResults: jsonb("tool_results").$type<{ toolName: string; input?: unknown; output: unknown }[]>(),
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

// Bộ nhớ dài hạn của agent, global không RLS, chỉ có hiệu lực sau khi admin duyệt ở /admin/knowledge.
export const knowledgeFiles = pgTable("knowledge_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  path: text("path").notNull(), // nhãn phân loại tự do kiểu đường dẫn, không unique, nhiều note có thể cùng path
  title: text("title").notNull(),
  content: text("content").notNull(),
  // Vector riêng của bảng này, không so sánh chéo với chunks.embedding (tài liệu user upload).
  embedding: vector("embedding", { dimensions: 768 }),
  status: knowledgeStatusEnum("status").notNull().default("pending"),
  proposedBy: uuid("proposed_by").references(() => users.id), // chỉ để admin có ngữ cảnh khi duyệt, không dùng lọc quyền
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => /* @__PURE__ */ new Date()),
}, (table) => ({
  // Lọc status='approved' ở mọi request action agent, thiếu index sẽ full-scan bảng này.
  statusIdx: index("knowledge_files_status_idx").on(table.status),
}));

export const userCorrectionMemories = pgTable("user_correction_memories", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  sourceType: text("source_type").notNull(),
  sourceId: text("source_id"),
  entityType: text("entity_type"),
  fieldName: text("field_name").notNull(),

  wrongValue: text("wrong_value"),
  correctedValue: text("corrected_value"),

  // Mã hoá ngữ cảnh thành 1 signature ổn định để query nhanh và gán đúng "cùng loại lỗi".
  contextSignature: text("context_signature").notNull(),
  contextJson: jsonb("context_json"),
  confidence: integer("confidence").notNull().default(0),
  status: correctionStatusEnum("status").notNull().default("active"),
  usageCount: integer("usage_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => /* @__PURE__ */ new Date()),
}, (table) => ({
  userStatusIdx: index("user_correction_memories_user_status_idx").on(table.userId, table.status),
  userSourceTypeIdx: index("user_correction_memories_user_source_idx").on(table.userId, table.sourceType),
  userFieldIdx: index("user_correction_memories_user_field_idx").on(table.userId, table.fieldName),
  userContextIdx: index("user_correction_memories_user_context_idx").on(table.userId, table.contextSignature),
  userIsolationPolicy: pgPolicy("user_correction_memories_user_isolation", {
    for: "all",
    to: appUserRole,
    using: sql`${table.userId} = current_setting('app.current_user_id')::uuid`,
    withCheck: sql`${table.userId} = current_setting('app.current_user_id')::uuid`,
  }),
})).enableRLS();

export const adminMetricEnum = pgEnum("admin_metric", ["signups", "ai_queries"]);
export const adminViewEnum = pgEnum("admin_view", ["week", "month", "year"]);

// Kết quả phân tích AI cho dashboard admin, luôn INSERT dòng mới để giữ lịch sử, không upsert.
export const adminChartAnalyses = pgTable("admin_chart_analyses", {
  id: uuid("id").defaultRandom().primaryKey(),
  metric: adminMetricEnum("metric").notNull(),
  view: adminViewEnum("view").notNull(),
  analysisText: text("analysis_text").notNull(),
  generatedBy: uuid("generated_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Truy vấn luôn lọc metric+view rồi lấy mới nhất, index đúng thứ tự cột lọc trước sắp sau.
  metricViewCreatedIdx: index("admin_chart_analyses_metric_view_created_idx").on(table.metric, table.view, table.createdAt),
}));

// Mỗi user tối đa 1 dòng/tuần, unique (userId, weekStart) dùng để check đã tạo tuần này chưa.
export const weeklyDigests = pgTable("weekly_digests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  weekStart: timestamp("week_start", { withTimezone: true }).notNull(),
  weekEnd: timestamp("week_end", { withTimezone: true }).notNull(),
  summaryText: text("summary_text").notNull(),
  // Số liệu thô AI dùng để viết summaryText, lưu lại để sau này hiện thêm dạng số/biểu đồ.
  stats: jsonb("stats").$type<{
    documentsProcessed: number;
    tasksCompleted: number;
    tasksOverdue: number;
    conversationsStarted: number;
  }>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userWeekIdx: uniqueIndex("weekly_digests_user_week_idx").on(table.userId, table.weekStart),
  userIsolationPolicy: pgPolicy("weekly_digests_user_isolation", {
    for: "all",
    to: appUserRole,
    using: sql`${table.userId} = current_setting('app.current_user_id')::uuid`,
    withCheck: sql`${table.userId} = current_setting('app.current_user_id')::uuid`,
  }),
})).enableRLS();

// Ngưỡng admin tự chỉnh qua /admin/settings, key/value phẳng, label/mặc định nằm ở SETTINGS_REGISTRY.
export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => /* @__PURE__ */ new Date()),
});

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
