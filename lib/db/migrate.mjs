import { runMigrations } from "./src/index.js";

runMigrations().catch(err => {
  console.error(err);
  process.exit(1);
});
