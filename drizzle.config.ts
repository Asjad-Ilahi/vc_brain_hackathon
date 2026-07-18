import { config } from "dotenv";
// Load .env.local first (Next convention), then fall back to .env.
config({ path: ".env.local" });
config({ path: ".env" });

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
