import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// db dùng role app_user (có RLS, qua withUserContext), dbAdmin dùng role admin_user (bypass RLS).
export const db = drizzle(postgres(process.env.DATABASE_APP_URL!), { schema });
export const dbAdmin = drizzle(postgres(process.env.DATABASE_ADMIN_URL!), { schema });
