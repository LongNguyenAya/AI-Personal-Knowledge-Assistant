import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@ai-assistant/db/src/schema";

const adminClient = postgres(process.env.DATABASE_ADMIN_URL!);
export const dbAdmin = drizzle(adminClient, { schema });