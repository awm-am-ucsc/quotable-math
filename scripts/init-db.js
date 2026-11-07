// Creates the tables in Turso. Safe to run more than once.
import { connect, schemaStatements } from "./db.js";

const db = connect();
await db.batch(schemaStatements(), "write");
const { rows } = await db.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
console.log("Tables:", rows.map((r) => r.name).join(", "));
