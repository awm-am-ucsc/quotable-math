-- Quotable Math archive schema (Turso / libSQL / SQLite).
-- The Google Sheet is the source of truth; `npm run import` rewrites quotes
-- and tags from it. Speaker rows are upserted, so bio and wikipedia_url filled
-- in directly in Turso survive re-imports.
--
-- A quotation is the only thing a row must have.

CREATE TABLE IF NOT EXISTS speakers (
  slug          TEXT PRIMARY KEY,          -- e.g. "maryam-mirzakhani"
  name          TEXT NOT NULL,
  gender        TEXT,                      -- self-identified only; never rendered on the site
  bio           TEXT,                      -- one or two sentences
  wikipedia_url TEXT
);

CREATE TABLE IF NOT EXISTS quotes (
  id            TEXT PRIMARY KEY,          -- stable hash of the quotation
  quotation     TEXT NOT NULL UNIQUE CHECK (length(trim(quotation)) > 0),
  speaker_slug  TEXT REFERENCES speakers(slug) ON DELETE SET NULL,  -- NULL = unknown speaker
  source_title  TEXT,
  source_url    TEXT,
  locator       TEXT,                      -- page number or timestamp
  date          TEXT,                      -- free-form: "2014", "Aug 2014"
  logged_by     TEXT,                      -- the rest are internal; never rendered on the site
  inspo         TEXT,
  status        TEXT,
  comments      TEXT
);

CREATE TABLE IF NOT EXISTS tags (
  slug  TEXT PRIMARY KEY,                  -- e.g. "applied-math"
  name  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quote_tags (
  quote_id  TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  tag_slug  TEXT NOT NULL REFERENCES tags(slug) ON DELETE CASCADE,
  PRIMARY KEY (quote_id, tag_slug)
);

CREATE INDEX IF NOT EXISTS quotes_speaker ON quotes(speaker_slug);
CREATE INDEX IF NOT EXISTS quote_tags_tag ON quote_tags(tag_slug);
