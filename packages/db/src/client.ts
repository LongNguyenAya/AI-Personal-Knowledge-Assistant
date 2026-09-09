import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// db uses role app_user (RLS enforced, via withUserContext), dbAdmin uses role admin_user (bypasses RLS).
export const db = drizzle(postgres(process.env.DATABASE_APP_URL!), { schema });
export const dbAdmin = drizzle(postgres(process.env.DATABASE_ADMIN_URL!), { schema });
