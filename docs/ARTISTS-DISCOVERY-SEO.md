# Artist workflow, profiles, discovery, and page URLs

## Artist dashboard

An artist can save a private draft with incomplete details and no artwork, reopen it, and preview it at `/studio/preview/{id}`. Preview APIs require the listing artist or an administrator. Drafts are absent from the public catalog, product pages, sharing images, and sitemap. Saving a published design as a draft pauses its listing.

Submission requires an English title and description, original artwork, and an explicit rights affirmation. Arabic copy and tags are editable alongside English. Artists suggest print formats and provide private production notes; Veelad sets pricing, available production quantity and product options. Submitted listings are pending. Administrators can approve, archive, or request changes. Requesting changes requires written feedback; feedback is visible in the artist dashboard/editor, not public product data. Saving a draft preserves the current feedback. Resubmission clears the current review and returns to pending. An administrator cannot publish an unsubmitted draft. Email notifications remain queued/held under the existing email settings; this work does not activate SMTP.

## Artist profiles

Shop settings support the artist's bio, location, longer story, and up to six portfolio images. Only artwork owned by that account can be added to its portfolio. Saving portfolio selections explicitly publishes those images through the controlled image endpoint. Removing a selection removes that public permission unless the same image is on an approved product. Suspended artists' profiles/portfolio are excluded from public artist data. No biography, artist photograph, or portfolio is invented. Initial catalog profiles remain labeled as examples.

## Discovery

Search combines words across English and Arabic product titles/descriptions/tags, category, artist name, and options; Arabic search ignores common diacritics and tatweel. Category/artist, minimum/maximum price, and in-stock/sold-out filters combine, retain selections during category changes, and appear as removable chips. Desktop controls and the phone filter sheet share the same values. Newest sorting uses the saved creation time. Empty searches provide suggestions based on actual catalog titles, artists, and categories, plus clear routes to broaden the search. Prices and stock at checkout remain enforced by MySQL.

## Normal URLs and SEO

Products use `/en/products/{id}` and `/ar/products/{id}`, artists use `/en/artists/{id}` and `/ar/artists/{id}`, and browsing uses `/en/shop` or `/ar/shop`. Legacy unprefixed English URLs remain supported. Workspace/account URLs also work on reload. Old `/#/product?id=...` and other hash links are translated in the browser so existing private email links and bookmarks continue to work. Private tracking/recovery tokens are excluded from canonical/meta URLs. Existing API compatibility remains `/api.php`.

Product and artist HTTP pages render individual titles/descriptions, canonical and Open Graph URLs, generated 1200×630 PNG sharing images, and structured Product/Person data before JavaScript runs. Product pages include text/price/artist links for crawlers; the buildless frontend hydrates the interactive storefront. Client navigation updates page metadata and supports refresh/back/forward. Missing/unapproved products return HTTP 404, and sharing endpoints never publish a draft. No review ratings are fabricated.

Staging always uses `noindex, nofollow`, a disallow-all robots file, and an empty sitemap. Production storefront sitemap includes only public pages, approved products, and available artists after its separate launch. Account, checkout, studio, tracking, and reset pages are not indexed. This change does not publish the production storefront or promise search engine indexing.

## Migration, validation and rollback

Migration `003-artist-operations.json` adds private `product_reviews` and `operational_status` tables. Product/artist story and portfolio fields stay in existing JSON records; original table column layouts remain compatible. Do not edit migration 001/002. The operations backup captures reviews, users, orders, products, and artwork together.

API tests cover private preview authorization, draft invisibility, required rights/feedback, resubmission, portfolio ownership/publication, HTTP metadata/status, sharing image generation, and sitemap privacy. Desktop/mobile browser tests cover actual draft→feedback→resubmit→approve, profile/portfolio publication, normal URL reload/back, discovery suggestions, and admin operations status. Existing customer checkout, private order tracking, email controls, and artist/gallery workflows remain covered.

For application rollback, keep the additive tables, disable backup/mail workers if rolling back before their compatible implementation, and preserve/reconcile any new drafts or change requests. Earlier code recognizes only pending/active/archived listings, so artists may need the current dashboard to edit newer statuses. Do not bulk-publish drafts or remove ownership/feedback records during rollback. Use isolated database/artwork restore for an incompatible data recovery; do not overwrite current orders.

Bilingual routing, RTL and typography are described in [I18N.md](../I18N.md). High-quality private originals, bounded public previews and the print/ship workflow are described in [DESIGN-PRODUCTION.md](DESIGN-PRODUCTION.md). No schema migration is needed for these additional JSON fields or per-user language preferences.
