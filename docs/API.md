# Frontend-compatible JSON API

The buildless frontend still calls `/api.php?route=NAME` on its own origin. Express serves that path; no PHP interpreter executes. GET requests use query parameters. POST accepts JSON up to 100 KB except `upload` and administrator artwork recovery, which accept multipart `artwork` (one PNG/JPEG, ≤25 MiB, minimum 100×100, ≤60 MP, no animation). Images are decoded to validate their content and then stored privately without changing the original bytes; filename and MIME come from decoded content. Image delivery validates ownership/approval and a safe stored basename, and returns a metadata-free WebP preview bounded to 1600×1600. High-resolution originals require the administrator-only download endpoint.

Bootstrap supplies a session CSRF token. All POST requests, including anonymous operations, require `X-CSRF-Token` and reject mismatched Origin/cross-site Fetch Metadata. Sessions live in MySQL with HttpOnly, SameSite=Lax host-only cookies, Secure for HTTPS, rotation on auth/password changes and suspension/password-stamp enforcement. Rate buckets use client IP and a 15-minute window; proxy trust must reflect actual hosting.

Errors: JSON `{error}` with 400/401/403/404/409/413/422/429 or 503; unexpected errors are generic. Read-only health returns `{ok,version,environment,revision,marketplace_enabled}`. Public bootstrap returns `{mode:'server',csrf,user,locale,products,artists,settings}`. Users never contain password hashes; public products never contain private production notes. No reusable HTTP install or setup-status endpoint is available.

| Route | Method / access | Input and response |
|---|---|---|
| bootstrap | GET public | active products, public artist profiles, settings, safe session user |
| health | GET public | database readiness and deployed revision |
| state | GET/POST signed-in | cart `{id,variant,qty}` and saved IDs; persist only valid products/options |
| language-preference | POST signed-in | `{locale:'en'\|'ar'}`; persists per user without changing cart, saved products or address; bootstrap returns `locale` |
| register | POST public | name,email,password,role; only buyer/artist allowed; safe user |
| login/logout | POST public | email/password or no body; session rotation |
| profile/password | POST signed-in | profile name and artist bio/location/story/portfolio; optional name_ar,bio_ar,location_ar,story_ar; current/new password |
| forgot-password | POST public | email; unavailable while mail disabled, otherwise generic queued result |
| reset-password | POST public | token,password; expiry, single-use and session invalidation |
| message | POST public | contact/newsletter,email,name,subject,message; `{ok}` |
| checkout | POST public | customer{name,email,address,city,postal,phone,country},cart,coupon,consent,request_key; `{order,guest_token}` |
| orders | GET signed-in | current account orders |
| order | GET owner/admin or private token | id,token query; unauthorized lookup returns 404 |
| upload/image | POST artist/admin / GET authorized | artwork → `{upload_id,artwork}`; image returns a bounded WebP preview following listing/portfolio visibility and ownership |
| artwork-metadata | GET artist/admin | id; `{artwork}` with pixel dimensions, byte size and calculated 300 DPI print-size guidance; artist must own artwork or its assigned listing |
| admin-artwork-original | GET admin | id; exact private original as an attachment; audit entry |
| admin-product-files | GET admin | product id; `{product_id,title,title_ar,has_original,files:[{id,primary,available,size_bytes,extension}]}`; no server paths, checks missing files |
| admin-product-files-download | GET admin | product id; audited ZIP attachment of up to seven unchanged originals/additional images, ≤25 MiB each; missing files fail before streaming; no product files returns 422 |
| studio | GET artist | own products and own order lines, no other customers' shipping addresses |
| artist-product | POST artist | id optional,title,category,description,variants,upload_id; optional bilingual fields,tags/tags_ar,print_formats,production_notes,product details,gallery_upload_ids (≤6); new submissions have price/stock zero, edits preserve administrator-set price/stock; `action:'draft'` saves privately, otherwise rights confirmation required and returns pending |
| admin | GET admin | products,safe users,orders,messages,settings,recent audit |
| admin-product | POST admin | listing fields,artist_id,status,review_feedback; active publication requires retail price, non-active review allows zero; audit |
| admin-order | POST admin | id,status,tracking; row lock, valid transitions, cancellation restocks once |
| admin-user | POST admin | id,status active/suspended; cannot change admin accounts |
| admin-message | POST admin | id → resolved and audit |
| admin-settings | POST admin | announcement,support_email,shipping,free_shipping,checkout_enabled,coupon_code,coupon_percent; optional delivery_estimate,returns_policy,announcement_ar,delivery_estimate_ar,returns_policy_ar |
| admin-record-payment | POST admin, local/test/staging opt-in only | id,reference; simulated external-payment record, no charge or transfer |
| admin-system | GET admin | DB driver, disabled/enabled mail and queue/paid-order counts |

Checkout validates 1–50 lines, integer quantities 1–20, active products/options and stock; ignores client prices/totals. Prices and configured discounts/shipping are computed in halalas. Products are locked in stable ID order; order idempotency is unique per session/request key and reserved before stock changes. Duplicate checkout returns the same order/tracking token without another stock decrement. The request key's scope changes when the session rotates; do not retry an old purchase after logout/login using a new session. Guest tracking tokens are secret-derived opaque values; imported PHP token hashes continue to verify supplied original tokens.

Product details are optional plain-text strings: materials/dimensions ≤300 bytes, care_instructions ≤1000, size_guide ≤2000. gallery_upload_ids accepts up to six private upload IDs, deduplicated and checked against upload ownership or assignment to the artist's own listing. Gallery images become public only when referenced by an active approved product. Pending images remain accessible to the upload owner, assigned listing artist and administrators. delivery_estimate ≤300 and returns_policy ≤3000 are administrator-managed store settings. Omitted new fields preserve saved values; empty strings/arrays clear them. No additional schema migration is needed for these JSON fields.

Arabic product fields are optional Unicode strings measured in characters: title_ar ≤100, description_ar ≤2000, materials_ar/dimensions_ar ≤300, care_instructions_ar ≤1000 and size_guide_ar ≤2000. Arabic profile name/location ≤100, bio ≤500 and story ≤3000; announcement_ar ≤150, delivery_estimate_ar ≤300 and returns_policy_ar ≤3000. Tags in either language accept up to 12 entries of 1–50 characters. `print_formats` accepts supported existing category keys. `production_notes` ≤2000 characters are private to the submitting artist and administrators, excluded from public responses and customer order snapshots. See [DESIGN-PRODUCTION.md](DESIGN-PRODUCTION.md) for print-quality checks and original-file handling.

Order states: awaiting_payment/new → cancelled; test payment record → processing; processing → shipped/cancelled; shipped → delivered. Paid cancellation sets refund_required; delivered/cancelled are terminal, repeat cancellation does not restock. Real gateway/payment webhooks, refunds, transfers and monthly ledger are not implemented. Existing product royalty snapshot fields are retained for frontend compatibility only.

Frontend CSS/imagery/slideshows remain intact apart from responsive form/confirmation fixes and accurate server/test-payment wording. Existing country choices are retained, but delivery integrations/coverage still require operational configuration. Unconfigured social profiles are not invented. Future OAuth/provider features described in the handoff are not treated as current features or credentials authorization.

Product design studio: authenticated `POST design-mockup` accepts `{id?,upload_id,category,design_studio}`, verifies original ownership/assignment and validated placement bounds, then returns `{mockup_upload_id,source_upload_id}`. It is limited to 25 requests per IP per 15 minutes; identical renders are cached by source/template/category/placement. Product writes accept the validated `design_studio` and matching `mockup_upload_id` (or `null` to clear). Public products omit private layout data; derivative previews follow existing image visibility rules. `GET admin-design-plan&id=PRODUCT_ID` downloads audited provisional placement instructions and requires an administrator. See [DESIGN-STUDIO.md](DESIGN-STUDIO.md).

## Customer designs

See [CUSTOMER-DESIGNS.md](CUSTOMER-DESIGNS.md) for setup and fulfillment. `upload` and `artwork-metadata` now permit signed-in customers accessing their own files; existing artist assignment and administrator access remain supported. `design-mockup` remains an artist/administrator listing endpoint.

`POST customer-design` requires an active account, CSRF, `{product_id,upload_id,design_studio,rights:true,preview_accepted:true}` and an available administrator-enabled `customer_customizable:true` product. Only the uploader's original `art-*` source is accepted. The server validates the layout, generates the private preview, and returns `{customization_id,customization:{customization_id,upload_id,mockup_upload_id,design_studio,category}}`. Identical normalized content saves reuse the same immutable ID. Limit: 25 attempts per IP per 15 minutes.

State/checkout cart lines accept optional `customization_id`. The server verifies its owner/product/category and current eligibility, ignores supplied customization bodies and prices, and keeps ordinary/cart-design lines distinct. Order items include unique `line_id`; personal items additionally include `customer_customized:true`, `customization_id`, immutable original/mockup/placement snapshots, `artist_id:null` and zero royalty. Admin product writes accept a strictly boolean `customer_customizable`; artist submissions cannot change this flag.

`GET admin-design-plan&id=PRODUCT_ID&order=ORDER_ID&line=LINE_ID` downloads the exact order-line snapshot. Omit `line` only when that product occurs once in the order, including compatibility with older orders. Ambiguous product-only requests return 422. Customer original downloads continue through administrator-only `admin-artwork-original`; no public customer design endpoint or public sharing image is created.

### Text layers and private working drafts

`design_studio.text_layers` optionally maps product IDs (`shirt`, `tote`, etc.) to up to four layers each; server normalization sets `text_version: "veelad-text-1"`. A layer contains `{id,text,font,color,x,y,size,rotation,align,direction}`. `text` is ≤120 Unicode characters/4 lines, `font` is `arabic`, `arabic-bold`, `manrope` or `dm-sans`, `color` is six-digit hex, normalized x/y are 0–1, size is .02–.2 of canvas width, rotation is ±180°, alignment is left/center/right and direction is auto/rtl/ltr. No HTML or font paths are accepted. Empty text rows can be saved in drafts; ordering without artwork requires nonempty text on the ordered product. Existing image-only layout hashes are preserved.

- `POST customer-text-preview`: authenticated/CSRF, `{category,layers}` → private `{layers:[{id,image:data-PNG-or-null}]}` glyphs shaped with the production fonts (600 attempts/IP/15 minutes). Physical positions/rotation are applied in the browser using these glyphs; final export re-renders them at the full provisional canvas resolution.
- `GET customer-library[&page=N]`: owner-only drafts and immutable designs, 24 per section/page, `{page,has_more,drafts,designs}`.
- `GET customer-draft[&id=DRAFT_ID]`: owner-only specified or latest active working draft and safe base-product fields. `copy=DESIGN_ID` instead loads an owner’s immutable design for a new working copy.
- `POST customer-draft`: `{id?,revision,title,product_id,variant,upload_id:null-or-owned-art-id,design_studio}` → `{id,revision,updated_at}`. New revision is 0; subsequent saves must match the current revision. Conflicts return 409 with `code: "DRAFT_CONFLICT"`; foreign/archived IDs are rejected. Empty/text-only drafts are supported. Same-product existing drafts remain editable when ordering is disabled. Active draft cap is 100/account; save limit is 1,200 attempts/IP/15 minutes.
- `POST customer-draft` with `{action:"archive",id,revision}` hides a working copy, never deletes originals or changes an order.
- `GET customer-draft-preview&id=DRAFT_ID`: owner-only generated bounded preview, never a public original (150 attempts/IP/15 minutes).
- `GET admin-design-artwork&id=PRODUCT_ID&order=ORDER_ID&line=LINE_ID`: audited, administrator-only flat composed PNG from the immutable order-line snapshot (10 exports/IP/15 minutes). It contains image + text, not the product photograph; dimensions remain provisional. Existing `admin-design-plan` now includes text-layer instructions. Source bytes and rendering fonts are preserved independently.

Customer design saves accept an optional title (80 Unicode characters) and `upload_id:null` for text-only layouts. Source-less preview IDs are scoped to their owner. Order lines include `design_title` when named and preserve text independently of later draft edits.

## Production preparation and proofs

- `POST admin-production`: administrator-only, order `id`, exact `revision`, `action=update` with `stage`, five boolean `checks` (`originals`, `placement`, `options`, `print_quality`, `packaging`), `internal_notes` and `customer_note`; or `action=proof` with exact `line_id`, administrator-owned original `upload_id`, optional `caption`. Returns the new revision. All writes are CSRF-protected and transactional.
- `GET order-proof-image&id=...&proof=...`: private WebP preview, requires the owning signed-in customer, administrator, or the existing guest `token`.
- `POST order-proof-response`: owning customer or guest token, order `id`, exact `revision`, latest pending `proof_id`, `decision=approved|changes_requested`; approval requires `confirm:true`, changes require `feedback`.
- `GET orders` and `GET order` return customer-visible production stage, proofs, feedback and progress history. Internal notes, checklist and private original IDs in proof records are stripped. Checkout retry responses use the same safe projection.
- `POST artist-products-batch`: artist-only, same fields as a new artist product plus stable `request_key` and two to seven distinct `print_formats`. Creates separate private/pending listings atomically, sharing the owned original. Repeated identical requests return the same IDs; changed retries conflict. Each category gets its own mockup when placement previews are enabled. Optional `source_product_id` on a new artist submission permits reusing artwork/gallery files already assigned to that artist’s own listing, including administrator-supplied originals; it does not grant access to another artist’s source.

No live payment or mail delivery is enabled by these routes. See [Production workflow](PRODUCTION-WORKFLOW.md) for gates and legacy compatibility.
