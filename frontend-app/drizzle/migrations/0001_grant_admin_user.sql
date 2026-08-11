-- Custom SQL migration file, put your code below! --

-- admin_user có BYPASSRLS nhưng CHƯA có quyền GRANT nào trên bảng nào cả — 2 lớp quyền khác
-- nhau trong Postgres, BYPASSRLS không tự kéo theo quyền DML. Thiếu bước này, mọi client dùng
-- admin_user (frontend-app/lib/db-admin.ts, và scheduler sắp thêm ở backend-service) sẽ lỗi
-- "permission denied" ngay từ câu query đầu tiên.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  users, session, account, verification,
  documents, chunks, tasks, conversations, reminders, chat_history,
  admin_audit_log, agent_prompts
TO admin_user;
