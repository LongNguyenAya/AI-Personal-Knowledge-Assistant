import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "../packages/db/src/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.PROD_DATABASE_MIGRATION_URL!,
  },
});
