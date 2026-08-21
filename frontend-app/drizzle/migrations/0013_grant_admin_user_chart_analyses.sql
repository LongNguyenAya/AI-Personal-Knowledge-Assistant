-- Custom SQL migration file, put your code below! --

-- admin_chart_analyses là bảng mới, tạo bởi role migration (postgres) nên chưa có quyền DML cho
-- admin_user — đúng thiếu sót đã gặp với các bảng trước (xem 0001_grant_admin_user.sql,
-- 0011_grant_admin_user_knowledge_files.sql). Không cấp cho app_user vì bảng này không có RLS,
-- chỉ dbAdmin (role admin_user) mới đụng tới, giống agent_prompts/knowledge_files.
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_chart_analyses TO admin_user;
