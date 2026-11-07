// Loads the whole archive once per build and shapes it for the templates.
// Without Turso credentials it falls back to data/sample.json so the site
// can still be previewed.
import { readFile } from "node:fs/promises";
import { connect, hasDbConfig } from "../../scripts/db.js";

async function fromTurso() {
  const db = connect();
  const [speakers, tags, quotes, quoteTags] = await Promise.all([
    db.execute("SELECT slug, name, bio, wikipedia_url FROM speakers"),
    db.execute("SELECT slug, name FROM tags"),
    db.execute(`SELECT id, quotation AS text, speaker_slug, source_title, source_url, locator, date
                FROM quotes ORDER BY rowid`), // rowid follows sheet row order
    db.execute("SELECT quote_id, tag_slug FROM quote_tags"),
  ]);
  const tagsByQuote = new Map();
  for (const { quote_id, tag_slug } of quoteTags.rows) {
    tagsByQuote.set(quote_id, [...(tagsByQuote.get(quote_id) ?? []), tag_slug]);
  }
  return {
    speakers: speakers.rows.map((r) => ({ ...r })),
    tags: tags.rows.map((r) => ({ ...r })),
    quotes: quotes.rows.map((r) => ({ ...r, tags: tagsByQuote.get(r.id) ?? [] })),
  };
}

async function fromSample() {
  // Never publish sample data: GitHub Actions sets CI=true.
  if (process.env.CI) throw new Error("TURSO_DATABASE_URL / TURSO_AUTH_TOKEN secrets are missing.");
  console.warn("[archive] No Turso credentials; using data/sample.json");
  return JSON.parse(await readFile(new URL("../../data/sample.json", import.meta.url), "utf8"));
}

export default async function () {
  const isSample = !hasDbConfig();
  const raw = isSample ? await fromSample() : await fromTurso();

  const speakers = new Map(raw.speakers.map((s) => [s.slug, { ...s, quotes: [] }]));
  const tags = new Map(raw.tags.map((t) => [t.slug, { ...t, quotes: [] }]));

  const quotes = raw.quotes.map((q) => {
    const quote = {
      ...q,
      speaker: speakers.get(q.speaker_slug) ?? null,
      tags: q.tags.map((slug) => tags.get(slug)).filter(Boolean),
    };
    quote.speaker?.quotes.push(quote);
    for (const tag of quote.tags) tag.quotes.push(quote);
    return quote;
  });

  // Quote of the day: short enough for the home page card, changes with each daily build.
  const cardable = quotes.filter((q) => q.speaker && q.text.length <= 150);
  const day = Math.floor(Date.now() / 86_400_000);
  const featured = cardable[day % cardable.length] ?? null;

  const byName = (a, b) => a.name.localeCompare(b.name);
  return {
    isSample,
    quotes,
    featured,
    speakers: [...speakers.values()].filter((s) => s.quotes.length).sort(byName),
    tags: [...tags.values()]
      .filter((t) => t.quotes.length)
      .sort((a, b) => b.quotes.length - a.quotes.length || byName(a, b)),
  };
}
