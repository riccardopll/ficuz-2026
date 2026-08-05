import { defineConfig } from "drizzle-kit";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const D1_DIR = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
const [database] = readdirSync(D1_DIR).filter((file) => file.endsWith(".sqlite"));

if (!database) {
  throw new Error("Run the local database migrations first");
}

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: join(D1_DIR, database),
  },
});
