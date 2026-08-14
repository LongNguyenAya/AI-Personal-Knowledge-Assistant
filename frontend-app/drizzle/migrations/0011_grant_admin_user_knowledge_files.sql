-- Custom SQL migration file, put your code below! --

-- knowledge_files là bảng mới, tạo bởi role migration (postgres) nên chưa có quyền DML cho
-- admin_user — đúng thiếu sót đã gặp với các bảng ban đầu (xem 0001_grant_admin_user.sql). Không
-- cấp cho app_user vì bảng này không có RLS, chỉ dbAdmin (role admin_user) mới đụng tới, giống
-- agent_prompts/admin_audit_log.
GRANT SELECT, INSERT, UPDATE, DELETE ON knowledge_files TO admin_user;
