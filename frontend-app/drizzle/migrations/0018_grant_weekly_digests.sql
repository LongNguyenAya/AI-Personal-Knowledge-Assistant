-- Custom SQL migration file, put your code below! --

-- weekly_digests cần CẢ 2 role: admin_user cho digest-worker.ts (quét, tạo digest cho MỌI user,
-- phải bypass RLS bằng dbAdmin — giống reminder-scheduler.ts dùng dbAdmin cho reminders), và
-- app_user cho route GET /api/digests (frontend-app, user chỉ xem được digest của chính mình qua
-- RLS). Thiếu 1 trong 2 sẽ gặp lại đúng lỗi "permission denied for table" đã gặp với
-- user_correction_memories.
GRANT SELECT, INSERT, UPDATE, DELETE ON weekly_digests TO admin_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON weekly_digests TO app_user;
