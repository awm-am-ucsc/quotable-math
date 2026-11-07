# quotable-math

A searchable, cited archive of quotes about doing mathematics, highlighting women and underrepresented mathematicians. Built by the Association for Women in Mathematics, Applied Math chapter at UCSC.

Live site: https://awm-am-ucsc.github.io/quotable-math/

## How it works

```
Google Sheet (members log quotes)
   │  npm run import   (daily in GitHub Actions, or by hand)
   ▼
Turso database
   │  npm run build    (Eleventy reads Turso at build time)
   ▼
Static site on GitHub Pages: one page per person and per topic
```

The Google Sheet is the source of truth. Each import replaces the quotes in
Turso with what's in the sheet. Database credentials are only used at build
time and never reach visitors' browsers.

## Logging quotes (no coding needed)

Add a row to the quotes sheet. Column names are matched loosely (case and spaces don't matter):

| Column | Required | Notes |
|---|---|---|
| Quotation | **yes** | Exact wording, unique across the sheet. Surrounding quote marks are stripped. |
| Speaker | | Full name, spelled the same way every time (it becomes the page URL). Blank shows as "Unknown speaker". |
| Source | | A title, or a bare link (shown as the site's name). |
| Link | | Optional separate URL, if Source holds a title |
| Page or timestamp | | Optional, e.g. `p. 42` or `12:30` |
| Date | | Optional. When it was said or published |
| Topic tags | | Optional. Comma-separated, e.g. `applied math, teaching` |
| Gender | | Self-identified only. Stored but **never shown** on the site. |
| Logger Name / Email | | Stored but not shown on the site. |
| Inspo / like, Status, Comments | | Stored but not shown on the site. |
| Publish? | | Optional. If the column exists, only rows marked `yes` / `TRUE` / `x` are published. |

Only Quotation is required; rows without one are skipped, and so are repeats of an earlier quotation. The header can be on any row; rows above it are ignored.

The site updates the next morning, or right away if someone runs the
**Sync sheet and deploy** workflow from the Actions tab.

Bios and Wikipedia links for people can be added in Turso's **Edit Data** tab
(`speakers.bio`, `speakers.wikipedia_url`); re-imports keep them.

## Local development

Requires Node 20+.

```bash
npm install
cp .env.example .env   # fill in Turso URL + token and the sheet link
npm run db:init        # create tables (safe to re-run)
npm run import         # sheet → Turso   (add -- --dry-run to preview)
npm run dev            # http://localhost:8080/quotable-math/
```

To empty the database and start over, `npm run db:reset` lists what's there, and
`npm run db:reset -- --yes` drops every table and recreates empty ones. This
can't be undone; `npm run import` refills quotes from the sheet, but bios and
links added in Turso are lost.

Without a `.env`, `npm run dev` shows sample data so you can work on the design.

## One-time GitHub setup

1. **Settings → Pages → Source:** GitHub Actions.
   The sheet must be shared as "Anyone with the link: Viewer". Turso tokens should have no expiry, or the daily sync stops when they lapse.
2. **Settings → Secrets and variables → Actions**, add:
   - `TURSO_DATABASE_URL`: `libsql://…turso.io`
   - `TURSO_READ_TOKEN`: Turso token with read-only access (used to build)
   - `TURSO_WRITE_TOKEN`: Turso token with full access (used to import)
   - `SHEET_URL`: the normal link to the quotes tab of the sheet
3. After the first deploy, add the site to [Google Search Console](https://search.google.com/search-console) and submit `sitemap.xml`.

## Project layout

```
schema.sql               database tables
scripts/import-sheet.js  Google Sheet → Turso
scripts/init-db.js       creates tables
src/_data/archive.js     reads Turso for the build
src/_data/site.js        site title, URL, org name
src/                     page templates and CSS
```
