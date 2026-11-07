// Imports the quote log from Google Sheets (as CSV) into Turso.
//
//   npm run import                 # uses SHEET_URL from .env
//   npm run import -- data/x.csv   # or a local CSV / URL
//   npm run import -- --dry-run    # parse and report, write nothing
//
// Quotes and tags are fully replaced on each run, so the sheet stays the
// source of truth. Speakers are upserted, keeping bio/links edited in Turso.

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { connect, schemaStatements, slugify, toCsvUrl } from "./db.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const source = args.find((a) => !a.startsWith("--")) ?? process.env.SHEET_URL;

// Sheet header -> field. Matching ignores case, spaces and punctuation, so
// "Topic tags", "topic_tags" and "Topic Tags:" all work.
const COLUMNS = {
  text: ["quote", "quotation", "text", "quotetext"],
  speaker: ["speaker", "name", "author", "fullname"],
  sourceTitle: ["source", "sourcetitle", "title"],
  sourceUrl: ["link", "url", "sourcelink", "sourceurl"],
  locator: ["page", "timestamp", "pageortimestamp", "locator"],
  date: ["date", "year"],
  tags: ["topictags", "tags", "topics"],
  gender: ["gender", "genderblankok", "speakeridentity", "identity"],
  loggedBy: ["loggedby", "member", "logger", "loggernameemail"],
  inspo: ["inspolike", "inspo"],
  status: ["status"],
  comments: ["comments", "notes"],
  publish: ["publish", "approved", "verified"],
};

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

async function loadCsv(src) {
  if (!src) throw new Error("No sheet given. Set SHEET_URL or pass a CSV path/URL.");
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(toCsvUrl(src));
    // A sheet that isn't shared redirects to Google's sign-in page instead of erroring.
    if (!res.ok || res.headers.get("content-type")?.includes("text/html")) {
      throw new Error(`Couldn't read the sheet (HTTP ${res.status}). Check that it's shared as "Anyone with the link: Viewer".`);
    }
    return res.text();
  }
  return readFile(src, "utf8");
}

// The header is the first row with a quotation column, so title rows or blank rows above it are fine. Returns field -> column index.
function findHeader(rows) {
  const has = (row, field) => row.findIndex((h) => COLUMNS[field].includes(norm(h)));
  const headerRow = rows.findIndex((row) => has(row, "text") >= 0);
  if (headerRow < 0) throw new Error('Sheet needs a header row with a "Quotation" column.');
  const cols = {};
  for (const field of Object.keys(COLUMNS)) {
    const index = has(rows[headerRow], field);
    if (index >= 0) cols[field] = index;
  }
  return { headerRow, cols };
}

// The Source column holds either a title or a bare link.
function parseSource(value) {
  if (!value || /^n\/?a$/i.test(value)) return {};
  if (!/^(https?:\/\/|www\.)\S+$/i.test(value)) return { title: value };
  const url = value.startsWith("www.") ? `https://${value}` : value;
  return { url, title: new URL(url).hostname.replace(/^www\./, "") };
}

// Rows are published unless a publish/approved column exists and says otherwise.
function isPublished(value) {
  if (value === undefined) return true;
  return ["y", "yes", "true", "x", "approved", "verified", "published", "1"].includes(norm(value));
}

function quoteId(text) {
  return createHash("sha1").update(norm(text)).digest("hex").slice(0, 10);
}

const csv = await loadCsv(source);
const rows = parse(csv, { trim: true, bom: true, relax_column_count: true });
const { headerRow, cols } = findHeader(rows);
const records = rows.slice(headerRow + 1);
const get = (row, field) => (field in cols ? row[cols[field]]?.trim() || null : undefined);

const speakers = new Map();
const tags = new Map();
const quotes = new Map();
const skipped = [];

records.forEach((row, i) => {
  const line = headerRow + i + 2; // sheet row number
  if (!row.some(Boolean)) return;
  const text = get(row, "text")?.replace(/^["“”]+|["“”]+$/g, "").trim();
  if (!text) return skipped.push(`row ${line}: missing quotation`);
  if (!isPublished(get(row, "publish"))) return skipped.push(`row ${line}: not marked for publishing`);

  const id = quoteId(text);
  if (quotes.has(id)) return skipped.push(`row ${line}: duplicate of an earlier row`);

  const name = get(row, "speaker");
  const speakerSlug = name ? slugify(name) : null;
  if (name) {
    const speaker = speakers.get(speakerSlug) ?? { slug: speakerSlug, name, gender: null };
    speaker.gender ||= get(row, "gender") ?? null;
    speakers.set(speakerSlug, speaker);
  }

  const tagSlugs = (get(row, "tags") ?? "")
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const slug = slugify(t);
      if (!tags.has(slug)) tags.set(slug, { slug, name: t.toLowerCase() });
      return slug;
    });

  const source = parseSource(get(row, "sourceTitle"));
  quotes.set(id, {
    id,
    text,
    speakerSlug,
    sourceTitle: source.title ?? null,
    sourceUrl: get(row, "sourceUrl") ?? source.url ?? null,
    locator: get(row, "locator") ?? null,
    date: get(row, "date") ?? null,
    loggedBy: get(row, "loggedBy") ?? null,
    inspo: get(row, "inspo") ?? null,
    status: get(row, "status") ?? null,
    comments: get(row, "comments") ?? null,
    tagSlugs: [...new Set(tagSlugs)],
  });
});

console.log(`Parsed: ${quotes.size} quotes, ${speakers.size} speakers, ${tags.size} tags.`);
if (!cols.sourceTitle && !cols.sourceUrl) console.warn("Warning: no source/link column found; quotes will have no citation.");
for (const s of skipped) console.log(`  skipped ${s}`);
if (dryRun) process.exit(0);
// The write below replaces everything, so a broken sheet must not wipe the archive.
if (quotes.size === 0) throw new Error("No publishable quotes found; leaving the database unchanged.");

const statements = [
  ...schemaStatements(),
  "DELETE FROM quote_tags",
  "DELETE FROM quotes",
  "DELETE FROM tags",
  ...[...speakers.values()].map((s) => ({
    sql: `INSERT INTO speakers (slug, name, gender) VALUES (?, ?, ?)
          ON CONFLICT(slug) DO UPDATE SET name = excluded.name,
            gender = COALESCE(excluded.gender, speakers.gender)`,
    args: [s.slug, s.name, s.gender],
  })),
  ...[...tags.values()].map((t) => ({ sql: "INSERT INTO tags (slug, name) VALUES (?, ?)", args: [t.slug, t.name] })),
  ...[...quotes.values()].flatMap((q) => [
    {
      sql: `INSERT INTO quotes (id, quotation, speaker_slug, source_title, source_url, locator, date,
                                logged_by, inspo, status, comments)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [q.id, q.text, q.speakerSlug, q.sourceTitle, q.sourceUrl, q.locator, q.date,
             q.loggedBy, q.inspo, q.status, q.comments],
    },
    ...q.tagSlugs.map((slug) => ({ sql: "INSERT INTO quote_tags (quote_id, tag_slug) VALUES (?, ?)", args: [q.id, slug] })),
  ]),
  "DELETE FROM speakers WHERE slug NOT IN (SELECT speaker_slug FROM quotes WHERE speaker_slug IS NOT NULL)",
];

const db = connect();
await db.batch(statements, "write"); // one transaction: all or nothing
console.log("Imported into Turso.");
