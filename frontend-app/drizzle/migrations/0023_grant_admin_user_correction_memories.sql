-- user_correction_memories chỉ từng grant app_user (0016) — thiếu admin_user khiến dbAdmin không
-- đọc/ghi được bảng này (đã xác nhận thật qua information_schema.role_table_grants). Chưa route
-- nào dùng dbAdmin cho bảng này nên chưa từng lộ ra lỗi, nhưng cần có sẵn cho tính năng sau này.
GRANT SELECT, INSERT, UPDATE, DELETE ON user_correction_memories TO admin_user;
