import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

// Loads .env if present (Node 20.12+), so local runs pick up Turso credentials.
try {
  process.loadEnvFile();
} catch {}

export function hasDbConfig() {
  return Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
}

export function connect() {
  if (!hasDbConfig()) {
    throw new Error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (see .env.example).");
  }
  return createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

export function schemaStatements() {
  const sql = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
  return sql
    .replace(/--.*$/gm, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Accepts a normal Google Sheets link (or a "Publish to web" link) and returns
// its CSV download URL. The tab in the link (#gid=...) is the one exported.
export function toCsvUrl(link) {
  if (link.includes("/spreadsheets/d/e/")) {
    const url = new URL(link);
    url.pathname = url.pathname.replace(/pubhtml$/, "pub");
    url.searchParams.set("output", "csv");
    return url.href;
  }
  const id = link.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/)?.[1];
  if (!id) return link;
  const gid = link.match(/[#?&]gid=(\d+)/)?.[1];
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
}

export function slugify(str) {
  return str
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
