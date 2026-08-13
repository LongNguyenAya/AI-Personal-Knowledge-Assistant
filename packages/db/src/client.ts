import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// File duy nhất định nghĩa db/dbAdmin — frontend-app và backend-service đều re-export từ đây
// thay vì tự khai báo riêng, tránh code trùng lặp giữa 2 nơi.
//
// db      — role app_user, có RLS, dùng khi thao tác thay mặt 1 user cụ thể (qua withUserContext).
// dbAdmin — role admin_user, bypass RLS, chỉ dùng khi thật sự cần quét/sửa chéo nhiều user
//           (scheduler tìm reminder tới hạn của mọi người, admin panel).
export const db = drizzle(postgres(process.env.DATABASE_APP_URL!), { schema });
export const dbAdmin = drizzle(postgres(process.env.DATABASE_ADMIN_URL!), { schema });
