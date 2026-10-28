# International storefront

Development branch: `feature/international-currencies`, based on Journal `eae7e43` (PR #14). This work is for staging review. Do not merge a production release without separate approval.

## Money and checkout

The nine supported display currencies are SAR, AED, BHD, KWD, OMR, QAR, EUR, USD and GBP. BHD/KWD/OMR have three minor-unit decimals; the others have two. Shared BigInt calculations avoid floating-point money arithmetic. Display components sum exactly; a snapshot records the difference from converting the net once. Half-up and half-even rounding and a bounded margin are configurable.

Products, stock prices, orders, artist royalties and partner ledgers remain integer SAR amounts. Customer currency preference is independent of language and shipping destination, saved locally and synchronized to authenticated customer state. Finance/admin screens retain SAR. Order history retains the original currency estimate and rate date rather than recomputing it at today's rate.

Moyasar currently provides only a test integration. No live charge/settlement currencies have been verified for this merchant. Currency selection does not enable live payments. Checkout discloses that converted amounts are estimates and shows the SAR order amount. New order JSON records `currency_snapshot`, including source, batch, date, margin, rounding, estimate, SAR amount and explicit null payment/settlement fields. A pending order must never be represented as a real charge. A future payment integration must populate actual provider-verified payment details; it must not infer them from an estimate.

## Exchange rates

`FX_ENABLED=true` enables the server scheduler (default on staging when the variable is absent). Default provider is ExchangeRate-API's open SAR feed, with visible attribution. An optional `EXCHANGE_RATE_API_KEY` selects its authenticated API. Keys stay server-side. Requests use fixed HTTPS hosts, bounded response size/time, no redirects, validation of all nine rates and source timestamps, and a cross-process lock. Rate batches are immutable. At most one scheduled attempt per hour; successful data is reused until the provider's next refresh time. Manual refresh is throttled.

Rates older than 36 hours are explicitly marked older estimates. After 72 hours they are unavailable and storefront prices fall back visibly to SAR. No seed or invented exchange rates are shipped. The admin page reports refresh errors without provider secrets. The development network returned HTTP 403 from the provider; verify the staging scheduler response before considering foreign-currency estimates operational.

## Languages, content and SEO

English (`en`), Arabic (`ar`, RTL), and Simplified Chinese (`zh-CN`, LTR) use separate URLs. The language selector preserves cart and form state. Chinese uses system CJK fonts. Translations live in explicit dictionaries; user-authored text is never translated by a DOM replacement pass.

Chinese product metadata uses optional `title_zh`, `description_zh`, `tags_zh`, and `seo_*_zh` fields alongside existing English/Arabic fields on the same product. Missing metadata falls back to the original. Existing artist submission/admin review rules apply. The admin International Settings page monitors missing title/description translations and links to correction forms; category labels can be edited without changing category IDs. Empty category overrides restore the built-in label.

Optional AI assistance requires `AI_TRANSLATIONS_ENABLED=true`, `OPENAI_TRANSLATION_API_KEY`, and `OPENAI_TRANSLATION_MODEL`. It sends only the explicitly confirmed product text to OpenAI, returns a bounded draft, and never writes or publishes a product. The artist reviews and applies the draft, then saves/submits through the normal workflow. Unconfigured service reports unavailable; manual translation remains usable. Generation is rate-limited and audited without logging the content or credentials.

Chinese UI coverage is intended for staging review. English fallback remains for missing interface strings and untranslated artist content. Legal policy bodies are not represented as professionally approved Chinese translations; Chinese legal screens show a review notice. Specialized operational notifications need a further editorial pass. Do not advertise a fully reviewed Chinese legal/operational experience yet.

Journal supports independent publication for all three languages, including Chinese slugs and per-language publication state. Canonical/hreflang, HTML language/direction, and per-language sitemaps are supported. Product structured data stays SAR because it describes the actual order price, not a personalized display estimate.

## Shipping and deployment

Currency/language never grant delivery eligibility. Existing configured shipping countries and fees remain authoritative; there is no newly verified worldwide fulfillment integration. Existing delivery restrictions continue to apply. No new tax or duty amounts are invented.

Migrations 018–020 add historical rate batches, widen the Journal locale columns, and keep rate JSON serialized as text to match the existing encrypted backup/restore contract. Existing migration files remain unchanged. No product/order deletion or sample catalog seeding is introduced. Rate batches are included in encrypted backups. Staging startup runs migrations. Production would need a separately reviewed migration/release procedure.

## Validation

New tests cover all nine precisions, all 27 formats, rate validation, exact component totals, rounding, immutable order snapshots, stale/unavailable behavior, admin permissions, authenticated preferences, Chinese routes/SEO/emails, shipping restrictions and checkout idempotency. Browser tests cover desktop/mobile switching, field/cart preservation, persisted preferences, product metadata and admin layout. Provider and AI tests use isolated fixture responses only.

Local full suite: 264/266 passed on MariaDB 11.8; the same two existing finance concurrency tests fail on unchanged Journal with `ER_CHECKREAD`. MySQL 8.4 CI passed the full backend suite. Its first browser run passed 173 tests and found one mobile gallery-position regression; mobile header spacing was tightened and the eight affected mobile storefront/international journeys passed locally. The final CI run must pass before staging promotion. No production deployment is authorized.
