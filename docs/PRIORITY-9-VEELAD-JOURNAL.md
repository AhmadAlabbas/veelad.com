# Priority 9 — Veelad Journal: Editorial and Reader Experience

This release builds on the existing Veelad Journal CMS and sample articles. It does **not** replace the editor, duplicate published content, add paid services, or publish fictional staging posts to production.

## Editorial changes

- Server-rendered **Explore by idea** tags, generated exclusively from the currently published catalogue and/or clearly labelled staging-only sample stories. No invented categories or empty-topic links. The strip remains readable without JavaScript, has English / Arabic / Simplified Chinese labels, and uses safe responsive chips.
- Editorial card rhythm: consistent full-height copy areas and aligned save controls, while actual image aspect ratios are maintained. The existing product, author, category, search, publish, schedule, and admin flows remain intact.
- Staging demonstration covers (SVG) now use `object-fit: contain` in card and article covers, avoiding distorted or cropped original illustrative artwork. Licensed user-uploaded photographs keep the existing editorial treatment.

## Reader experience

- Articles with actual h2/h3 headings generate a stable, server-rendered **In this article** reading guide. Headings receive unique anchor IDs (preserving existing safe IDs). Links remain usable with JavaScript disabled and in authenticated previews; plain articles with no headings do not show an empty guide.
- Sticky desktop guide; on narrow devices the links reflow as touch-friendly rows. Current section highlights automatically as the reader scrolls.
- **Start reading** and **Back to top** anchors with multilingual labels, including Chinese.
- Reading progress tracks the article's own content instead of counting shopping suggestions and the site footer.
- Read time uses a basic character-based estimate for CJK text, avoiding the "1 min" outcome for a substantial Chinese article.

## Safety and publishing boundaries

- No change to CMS storage schemas, author permissions, translation publication status, SEO indexability, redirects, staging/production separation or media access control.
- Existing eight **SAMPLE** posts are visible only in staging and are explicitly labelled fictional; no AI-generated claims, fake interviews, products, shipping terms, or buyer data are added.
- Frontend stylesheet and script references have new cache versions so visitors receive the corrected layouts.
- Production, checkout, payments and public content remain untouched.

## Validation

- `tests/journal-priority9-reader.test.js`: unique heading anchors, inline markup text, CJK read time, English/Arabic/Chinese article guides, published-tag discovery, and non-public sample safeguards.
- `tests/browser/journal.spec.js`: existing CMS creation/publishing/privacy flow plus live, published article heading-navigation checks.
- Existing `tests/journal-demo-page.test.js`, `tests/journal.test.js`, `tests/journal-demo.test.js` and the regular browser suite remain part of CI.
- Deploy staging branch and verify exact SHA via `/api.php?route=health`; inspect Journal hub/article paths in each supported language.
