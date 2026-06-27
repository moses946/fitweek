import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required. Migrations require a direct database connection, not a pooler.",
  );
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // Ensure we don't accidentally drop tables managed by Supabase (like auth.users)
  tablesFilter: ["profiles", "garments", "outfit_slots", "vto_results"],
});
