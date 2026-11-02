# Priority 5 — Artist platform integration (staging)

The project already had secure artist-owned product submissions, a reviewed-publication process, artist storefronts, a private profile draft and explicit publication flow, private portfolios and featured products, up to six shop sections, an artist earnings disclaimer and administrative review. This release connects these into a clearer **artist workflow**, without rewriting working security-critical systems.

## Implemented
- Artist studio sidebar **My collections**: a focused collection organizer at `/en/studio?tab=collections` (localized language equivalent).
- The collection organizer uses **exactly the existing versioned private artist-profile draft**, ownership validation, autosave, conflict detection, portfolio and featured-product data. Hidden profile fields remain in the form and are retained on save; no parallel/unverified store of artwork data.
- Each artist can draft up to six collections, translate headings/introductions, select from their **own** products, reorder collections, preview the public artist shop, and explicitly publish. Unapproved product links remain non-public.
- Artist dashboard **What needs your attention**: prioritizes up to five changes-requested, draft and pending designs, shows ownership-scoped administrator review feedback, and links directly to the existing secure Edit Design flow. Review feedback and titles are HTML escaped.
- Dashboard shortcuts open artist collections, profile editor and upload workflow. All new UI is responsive.

## Security and constraints
- **No automatic publication**: drafts/collections remain private until explicit artist profile publication; each public product still needs administrator approval.
- No new API endpoints, new product permission rules or database migrations. Existing role checks, artist ownership validation, concurrency checks and image ownership protections remain in place.
- Financial dashboards show recorded order facts only; no invented royalties, verified settlements or bank payout capabilities.
- Checkout, pricing, fulfilment, production domain, payments and user accounts unchanged.

## Tests
- `tests/artist-workflow.test.js`: priority work queues, feedback escaping, bounded rendering and collection links.
- `tests/browser/artist-profiles.spec.js`: new dedicated collection route, sidebar navigation, private saving/reloading, profile-field preservation, explicit publication visibility on the public artist shop. Runs desktop and mobile.
- Existing artist profile browser tests still cover ownership, portfolio crop, multilingual preview, conflicting tabs and mail preferences. Full CI and a staging visual review required before claiming ready.

Rollback: restore preceding staging commit. Existing draft records continue to use migration 015 and need no conversion; follow backup/restore procedures before undoing staging state.
