import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./backend/src/db/schema",
  out: "./backend/src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://localhost:5432/ile_db",
  },
});
