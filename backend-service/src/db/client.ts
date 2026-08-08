import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@ai-assistant/db/src/schema";

export const pgClient = postgres(process.env.DATABASE_APP_URL!);
export const db = drizzle(pgClient, { schema });