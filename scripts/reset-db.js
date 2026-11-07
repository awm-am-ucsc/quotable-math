// Empties the Turso database and recreates the tables from schema.sql.
//
//   npm run db:reset             # list what's there, change nothing
//   npm run db:reset -- --yes    # drop every table. Cannot be undone.

import { connect, schemaStatements } from "./db.js";

const db = connect();
const { rows } = await db.execute(
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%' ORDER BY name",
);
const tables = rows.map((r) => r.name);
const quoted = (name) => `"${name.replace(/"/g, '""')}"`;

for (const table of tables) {
  const { rows: [{ n }] } = await db.execute(`SELECT count(*) AS n FROM ${quoted(table)}`);
  console.log(`${table}: ${n} rows`);
}
if (tables.length === 0) console.log("No tables.");

if (!process.argv.includes("--yes")) {
  console.log("Nothing changed. Re-run with --yes to delete all of this.");
  process.exit(0);
}

await db.batch(
  ["PRAGMA defer_foreign_keys = ON", ...tables.map((t) => `DROP TABLE ${quoted(t)}`), ...schemaStatements()],
  "write",
);
console.log("Database reset: all tables are empty.");
