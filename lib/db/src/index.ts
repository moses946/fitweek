import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const { Pool } = pg;

// We support two connection strings:
// 1. DATABASE_POOL_URL: The PgBouncer pool connection string (default for runtime queries)
// 2. DATABASE_URL: The direct connection string (required for migrations, fallback for runtime)
const connectionString =
  process.env.DATABASE_POOL_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_POOL_URL or DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Tuned connection pool to prevent exhaustion and zombie connections
export const pool = new Pool({
  connectionString,
  max: 10, // Max concurrent connections per serverless instance
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 5000, // Fail fast if we can't connect
  allowExitOnIdle: true, // Don't block the Node event loop on shutdown
});

// Graceful shutdown: close pool when process exits
process.on("SIGINT", () => {
  pool.end();
  process.exit(0);
});
process.on("SIGTERM", () => {
  pool.end();
  process.exit(0);
});

export const db = drizzle(pool, { schema });

/**
 * runMigrations — programmatic migration helper.
 * MUST be run using the direct DATABASE_URL, not the pool URL.
 */
export async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required to run migrations (direct connection needed, not PgBouncer).",
    );
  }

  console.log("Running pending migrations...");
  const migrationPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1, // Migrations should be single-threaded
  });
  const migrationDb = drizzle(migrationPool);

  await migrate(migrationDb, { migrationsFolder: "./drizzle" });
  await migrationPool.end();
  console.log("Migrations complete.");
}

export * from "./schema";
export * from "./queries/garments";
