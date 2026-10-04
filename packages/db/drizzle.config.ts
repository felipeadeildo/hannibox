import { defineConfig } from "drizzle-kit"

// Wrangler applies these migrations to D1; see `migrations_dir` in apps/api/wrangler.jsonc.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./migrations",
})
