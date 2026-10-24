# Shopping quality and non-payment improvements

This change adds shared interface foundations, clearer product decisions, reviewed artist quick personalisation, catalogue presentation/review, and optional aggregate shopping measurement. It does not change Moyasar, payment methods, charging, refunds, or payment status rules.

## Customer experience

The shared UI stylesheet defines control sizes, focus treatment, radii and form behaviour. Product pages show confirmed material/dimension information near the purchase controls, a destination link, help and return-policy navigation. Missing specifications stay explicitly unconfirmed.

A customisable product can show reviewed artist typography layouts. A customer edits permitted fields/fonts/colours directly on the product page, generates a private product mockup and explicitly approves it before adding to the existing bag. Artist artwork in the original product photo is not transferred into this text layout. Colour/fit selections remain order choices; the preview is a generic, provisional placement. Personalisation snapshots preserve the artist and royalty information. Text that would clip outside the artist layout is rejected using the actual shaped glyph bounds, including Arabic. Editing after a preview invalidates the old preview, and stale asynchronous results cannot enable an old design.

The shop has Designs/Products browsing modes, accurate grouped counts and entry points into existing curated collections. It does not manufacture catalogue artwork, artist stories, prices or supplier details. Administrators review actual products through Catalogue quality, with links back to the existing editor. Its checklist measures content completion, not commercial or production readiness.

## Measurement

Visitors choose whether to enable measurement in the footer's Privacy choices; default is off. The client sends only allowlisted events, public product references, route categories, broad error categories and capped route timing. No account IDs, emails, search terms, artwork, design text, full URLs, stack traces or persistent visitor identifiers enter the measurement tables.

Events are counted in UTC daily aggregates for 90 days. Random per-event receipt hashes deduplicate retries; receipts are removed after two days. These are event counts, not unique visitors or causal conversion rates. `order_received` describes acceptance by the existing order flow and does not mean payment succeeded. Measurement can be disabled prospectively at any time; anonymous totals cannot be attributed back to one visitor for individual deletion.

The administrator dashboard supports 7/30/90-day views, stage counts, page-speed buckets, error totals and most-viewed items. Counts remain empty until real opted-in activity occurs. Maintenance removes old rows in bounded hourly batches.

## Configuration, APIs and persistence

`SHOP_ENHANCEMENTS_ENABLED` defaults on in local/test/staging and off in production. Explicit `false` disables the new routes in any environment. Existing payment flags are unchanged.

- GET shopping-product?id: published product's approved, rights-confirmed text layouts; no private originals.
- POST shopping-personalisation-preview {id}: authenticated owner's immutable personalisation rendered to a private JPEG response.
- POST shopping-events {consent:true,events}: strict allowlist, rate limits, bounded batches and retry deduplication.
- GET admin-shopping-quality: existing administrator content checklist.
- GET admin-shopping-insights?days=7|30|90: administrator-only aggregates.

Migration 014 adds shopping_metrics and shopping_metric_receipts. Both are included in encrypted backups/restoration, taking the full set to 56 tables. The existing additive migration compatibility rules continue to apply.

## Testing and human review

Automated tests cover consent enforcement, rejected identifying fields, duplicate-event retries, admin authorisation, preview ownership, actual JPEG output, preview approval, preserved artist snapshots, bag options, content truthfulness, browsing modes and consent withdrawal. English/Arabic laptop/mobile visual checks accompany the changes. The prepared five-person protocol is in `usability/FIVE-PERSON-TEST.md`; actual human sessions still require real participants and are not claimed as completed.
