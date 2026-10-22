# Catalogue launch: styles, prices, homepage and payment preparation

This release prepares the empty production shop for the owner's first real collection. It does not import artwork, create product listings, change existing selling prices, enable checkout, or turn on payment processing. The owner authorised temporary setup prices; those are explicitly marked as placeholders. Development goes to staging first; releasing to production remains deliberate.

## Browse by artwork style

The twelve bilingual styles are Saudi nostalgia, Arabic lettering, vintage travel, cinematic worlds, space and science, nature and botanicals, Japanese-inspired illustration, music and analogue, architecture and geometry, playful everyday, sport and motoring, and contemporary abstract. The source is `public/assets/design-styles.json`; server validation reads this same file and bootstrap supplies it to the browser.

A style describes the artwork. A category describes the physical product: T-shirt, tote, mug, notebook, phone case, art print or sticker. One design may have up to three styles and appear on several separately priced products. Choose styles in either the administrator product editor or the artist submission form. Ordinary edits from clients that omit the style field preserve the previous selection; an explicit empty array clears it.

Customers use the homepage cards, shop style navigation, mobile menu, desktop filter form or mobile filter sheet. Style, category, artist, search, price and availability filters work together. Product pages link back to their assigned styles. Language switching preserves the selected filters. An empty style page explains that work is forthcoming and does not invent products, prices or counts.

The shop renders 24 products per page; the product management workspace renders 50. Filter changes reset the page. Pagination retains the other query parameters and language. A browser fixture exercises 500 product records in both desktop and mobile projects. This validates browsing a 500-product catalogue; it does not mean that 500 printable artwork masters have been created or quality checked. Bootstrap still downloads the public catalogue; a substantially larger catalogue should move discovery to server-side pagination rather than merely raising these page sizes.

## Homepage

The expanded homepage includes a campaign hero, entry points, all seven product categories, twelve illustrated design styles, actual product sections when products exist, an everyday-products edit, a creative studio story, artist sections when artists have published products, a practical FAQ and a creator invitation. Empty shops retain useful editorial sections without fake listings or testimonials.

`public/assets/style-atlas.webp` is one optimised 4-by-3 illustration atlas; CSS selects the corresponding style panel. It is navigation imagery, not a print original or a set of product records. `public/assets/lifestyle/homepage-editorial.webp` is an AI-generated campaign image, visibly labelled as illustrative. Product mockups remain provisional. The artwork has not been certified against supplier templates or physical samples.

Server storefronts no longer show the development-style workspace banner. Anonymous visitors do not receive the administrator link in the footer. Demo mode retains its explicit demo label. Newsletter submissions continue to save a contact record; this release does not add marketing broadcasts or an automatic unsubscribe service. The footer tells customers they can contact the store to remove their address.

## Set selling prices

Open **Administrator → Product pricing**. The owner requested temporary editable setup prices. Unconfigured categories show the following provisional defaults from `public/assets/launch-pricing.json`: T-shirts 99 SAR, tote bags 59 SAR, mugs 49 SAR, notebooks 39 SAR, phone cases 69 SAR, art prints 79 SAR and stickers 12 SAR. They are labelled **Placeholder price**, are not cost or market estimates, and do not replace any previously saved prices. Enter the owner's reviewed prices, or leave an undecided price blank. Exact integer halalas are stored as `settings.category_pricing`; concurrent edits use `pricing_revision` and reject stale saves. Saved price defaults and their revision are omitted from public settings; the static provisional examples themselves are not private information.

These are defaults for new administrator listings. Saving them never rewrites existing product prices or historical order snapshots. A new listing starts with the relevant default; changing the category follows defaults until the owner manually edits its price. Existing listings retain their own price. New listings start pending with zero availability. Placeholder defaults carry a `price_is_placeholder` flag into new drafts. Entering a reviewed price clears that flag; publication and checkout reject it while it is still set. Legacy edits and artist resubmission preserve it. An unset price can remain zero while pending; publishing still requires a valid selling price. Review supplier costs, shipping, taxes, artist shares and the merchant's final payment fees before enabling checkout.

Visible prices use the Saudi riyal sign at **U+20C1** in both languages, including when Arabic numerals are selected. A self-hosted symbol-only font fallback provides the glyph on systems that lack it. Monetary text is directionally isolated; calculations and structured-data `priceCurrency: SAR` are unchanged. See `public/assets/fonts/SAUDI-RIYAL-SOURCE.md` and its bundled licence.

An administrator can select **My own designs** on a new listing. On saving that listing, the server creates an artist profile for the authenticated owner's account if it does not exist. It does not create a substitute account, assign another user's identity, or create a public sample artist during deployment.

## Payment marks and Moyasar preparation

The reviewed offer identifies mada, Visa, Mastercard, Apple Pay and Samsung Pay as core methods. Their self-hosted brand marks appear in the footer under **Planned payment methods**. The text explicitly says online payments are not active yet. Amex and stc pay are additional services in the offer, so this release does not advertise them as active or included. Methods described as forthcoming in the offer are also not advertised as available. No commercial fee schedule or private offer PDF is committed.

The payment brand assets include source and licence notices in `public/assets/payment-methods/`. Their presence does not verify merchant activation, device eligibility or checkout support.

No environment change is needed to deploy the storefront improvements. Once a Moyasar account exists, an optional **staging-only, read-only** test connection check can be configured privately:

```dotenv
MOYASAR_TEST_ENABLED=true
MOYASAR_TEST_SECRET_KEY=YOUR_PRIVATE_SK_TEST_KEY
```

Use a real **test secret** in hPanel, never in GitHub, screenshots, chat, a browser asset, or a publishable-key field. Keep the flag false and the secret empty until that point. In **Administrator → System → Moyasar payment setup**, check the connection. The server makes an authenticated `GET` to the fixed HTTPS invoice-list API; it creates no invoice, charge or refund and returns no provider invoice data. Requests have a timeout, cannot follow redirects, and do not expose provider error bodies or keys. CSRF, administrator role checks, throttling and an audit record protect the check. Live keys are rejected; production cannot run the check, even if the test flag is set.

**This is payment preparation, not a completed payment checkout integration.** There is no live-payment creation endpoint, wallet widget, webhook receiver, automated settlement, or refund implementation in this release. Entering the key does not activate any of those features. Provider credential verification remains untested against a real merchant account because the account and test key were not yet available. The connection check is covered using a simulated provider response. The official documentation host was unavailable from the execution environment; the read-only invoice-list contract was cross-checked against Moyasar's public SDK source. Reconfirm the current API documentation during merchant onboarding.

Before a future payment release: confirm the signed agreement and enabled methods; implement and test provider checkout with server-calculated integer amounts; authenticate payment notifications and re-fetch provider status; match order, amount, currency and payment identity; handle duplicates, retries, failures, cancellation and delayed notifications; reconcile orders when a browser does not return; test refunds and wallet/device requirements; review policies and pricing; then perform a separate deliberate production activation. A browser return URL must never by itself mark an order paid.

## First collection workflow

1. Decide the collection's real artwork themes and enter the seven selling prices.
2. Keep a native master outside the shop as well as in private storage. Review Arabic lettering, intended print size, transparency, colour and rights. A small generated preview is not a large-format print master.
3. Add the original, bilingual title and useful description; assign up to three styles. Preview placement on every intended product. Artist batch submissions can create several product listings from the same private original.
4. Review each product's price, options, physical specifications, stock/availability and mockup. Publish in small reviewed batches. Do not use invented supplier sizes, shipping times or test prices as final information.
5. Check shop filters and both language pages after the first batch, then continue. Five hundred designs can produce more than five hundred product listings; count unique originals separately from product variants/listings.
6. Complete storage continuity, independent backup recovery and the payment release checks before accepting real paid orders.

## Deployment, validation and rollback

No database schema migration is needed. Styles and the placeholder-price marker are additive product JSON fields; saved price defaults are additive settings fields. Existing orders and private files are not rewritten. Backups already include these products and settings records.

Run `npm run check`, the Node tests and affected desktop/mobile browser workflows. Browser checks include an empty store, style links, Arabic direction, the five actual payment image files, exact price saving, the owner's first listing and a 500-product discovery fixture. Use `PLAYWRIGHT_BASE_URL` to choose a separate local server port if necessary. Review the homepage and footer screenshots before promotion. Deploy the tested commit to staging and verify the exact revision; keep production's catalogue and credentials separate.

Rollback the application to its previous tested commit without deleting product data or private artwork. Pause product editing while running older code: it may ignore or discard newly added style metadata when saving a record. Keep the pre-release database backup. Pricing defaults do not alter historical amounts, and payment preparation has no live charge state to roll back.
