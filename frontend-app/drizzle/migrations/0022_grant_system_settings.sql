-- system_settings không RLS — chỉ đọc/ghi qua dbAdmin ở cả 2 phía, không route nào dùng app_user
-- cho bảng này nên chỉ cần grant admin_user — thiếu sẽ gặp lại lỗi "permission denied" như user_correction_memories.
GRANT SELECT, INSERT, UPDATE, DELETE ON system_settings TO admin_user;
