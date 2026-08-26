import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./frontend/drizzle",
  schema: "./frontend/db/schema.ts",
  dialect: "sqlite",
});
