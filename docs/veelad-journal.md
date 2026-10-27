# Veelad Journal

An editorial section of the existing Node/Express application. No external CMS, paid service, extra account system or fabricated launch content. The initial migration adds ten categories only; authors and articles are created by administrators.

## Read and publish

- English: `/journal`, `/journal/:slug`.
- Arabic: `/ar/journal`, `/ar/journal/:slug`.
- `/en/journal` and its article URLs redirect to the English canonical route.
- Existing admin: `/en/admin?tab=journal` or `/ar/admin?tab=journal`.
- Create an author in **Authors**, create an article, and fill the English or Arabic tab.
- Upload PNG/JPEG covers and article images (existing 25 MB / 60 MP validator). Add descriptions and optional captions. Rich content supports paragraphs, headings, bold/italic, lists, links, quotes and simple editable tables. Pasted text is unformatted; HTML is sanitized on the server.
- Pick actual products and artists using **Connect the story**. Readers only see currently active products and eligible profiles.
- Save a draft, then use **Preview saved version**. Previews are authenticated and use private image URLs.
- Set that language's status to Published, or Scheduled with a future time, then save. Scheduled times use the editor's device timezone and are stored as UTC. The existing server timer pattern publishes due translations every minute, in batches of 25. A paused server resumes on its next maintenance interval.
- A published save changes the live article immediately. Select Draft to unpublish that language. There is no separate revision-history workflow in this release.
- An untranslated language stays private. Switching languages takes readers to the actual translated slug, or to that language's Journal index if a translation is unavailable.
- Archive hides both languages without deleting the article or original images. Uncheck Archive to restore its saved publication states. Used authors/categories cannot be removed until their articles are reassigned.
- Tags are edited as a comma-separated list on each translation. Categories have editable bilingual names and display order. Authors have bilingual names and biographies.
- Conflicting saves from another tab are rejected; reopen to review the latest version. Navigation warns about unsaved edits. There is no autosave: use Save changes before closing the browser.

## Design and discovery

Shared storefront header, footer and mobile menu; distinct Journal item in the existing admin navigation. Editorial masthead, responsive cover feature, non-repeating latest/artist/style sections, category navigation, search, tags and 12-item pagination. Empty states contain no sample stories. A readable server-rendered page remains available without JavaScript.

Each language has an editable SEO title/description, canonical URL, available-translation hreflang, Article JSON-LD, Open Graph image/title/description, sharing links and sitemap entries. Drafts, archived articles, protected previews and unpublished image URLs are unavailable publicly. Search/filter pages and staging are noindex. Old slugs redirect only to a currently published translation. Images are bounded WebP variants (480/960/1600), with responsive sources and lazy loading below the cover. Permission checks run before image delivery, including cached source previews.

## Schema, backup and files

Additive migration `017-journal.json`: `journal_categories`, `journal_authors`, `journal_articles`, `journal_translations`, `journal_redirects`, `journal_media`. Existing users, products and orders are preserved. The migration identifier avoids the separate, unreleased 016 work.

Journal tables and private source uploads are part of the existing encrypted backup. Isolated restore replaces the fresh target's migration-provided category defaults with the exact saved categories, including edits/removals. It never clears a live database. Restoration tests include private Journal content, media associations and slug history.

Main implementation: `src/journal.js`, `src/journal-pages.js`, `public/assets/journal.js`, `public/assets/journal.css`. Integrations: app/server/pages, backup table registration and isolated restore, existing frontend navigation/header/footer/mobile menu, index assets, and `sanitize-html` dependency. Tests: `tests/journal.test.js`, `tests/browser/journal.spec.js`, Journal fixture helper, workspace navigation and backup rehearsal coverage.

## Review and deployment

Work branch: `feature/veelad-journal`. Review through a pull request; no production release is authorized by this change.

1. Run `npm ci`, `npm run check`, `npm run build`, `npm test`, and browser checks with an isolated local database.
2. Push the tested commit to the staging branch. Existing staging startup runs additive migrations. Confirm the exact health revision, `/journal`, `/ar/journal`, admin access restrictions, assets and the noindex rule.
3. Review using real draft content in staging. Production can remain on its existing release.
4. Only after explicit production approval: back up production, apply the migration with the existing migration runner before starting the new release, then use the existing reviewed production workflow. Hostinger's production process does not migrate implicitly; if a shell/build migration step is unavailable, prepare and review the equivalent SQL import first.
5. After release, verify the revision, both Journal indexes, sitemap, a real published article, image access and a draft's 404 response. Application rollback can retain the additive Journal tables; do not drop editorial data.

No production content, verification settings, payment logic or credentials are changed. Publishing content still requires a real author, title, summary, body, category, cover and meaningful image descriptions. Existing analytics/newsletter/payment behavior is reused, not expanded.

## Validation record

- 253 backend checks passed across the full suite and isolated integration rerun. A reused local test database held an earlier, development-only migration checksum; the 36 integration checks were rerun successfully in a newly created disposable database.
- 13 Journal backend checks cover authorization, sanitization, private drafts/media, publication requirements, preview, independent translations, canonical/schema/sitemap output, slug collisions/redirects, optimistic versions, search/filter/pagination, taxonomy management, unpublishing/archive and scheduled publication.
- 30 browser checks passed; two viewport-specific mobile checks intentionally skip in the desktop project. Coverage includes Journal, existing bilingual pages/admin, mobile shopping/cart, checkout/tracking, artist upload/approval, footer links and workspace navigation.
- Four focused Journal browser checks passed again after final changes, in desktop and phone Chromium. Screenshots were inspected for editorial layout and RTL. This is not a claim of real-device Safari testing.
- Syntax/build and whitespace checks pass. Published test articles and test authors exist only in disposable local databases; none are seeded into staging or production.
- Hosted staging browser checks passed at 1366, 390 and 320 px in English and Arabic, with correct direction, no horizontal overflow, working article search and no client errors. Both index routes return HTTP 200 with staging noindex; anonymous editorial API access returns HTTP 401. A visual review found and corrected an inherited link-color conflict on the dark empty-state button, with a browser regression assertion for its readable text.
