import { runMigrations } from "../src/server/db.js";

runMigrations();
console.log("Migrations complete.");
process.exit(0);
