# Frontend-compatible JSON API

The buildless frontend still calls `/api.php?route=NAME` on its own origin. Express serves that path; no PHP interpreter executes. GET requests use query parameters. POST accepts JSON up to 100 KB except `upload`, which accepts multipart `artwork` (one PNG/JPEG, ≤8 MB, minimum 100×100, ≤36 MP, no animation). Images are decoded/re-encoded, metadata stripped and stored privately; filename and MIME come from decoded content. Image delivery validates both ownership/approval and a safe stored basename.

Bootstrap supplies a session CSRF token. All POST requests, including anonymous operations, require `X-CSRF-Token` and reject mismatched Origin/cross-site Fetch Metadata. Sessions live in MySQL with HttpOnly, SameSite=Lax host-only cookies, Secure for HTTPS, rotation on auth/password changes and suspension/password-stamp enforcement. Rate buckets use client IP and a 15-minute window; proxy trust must reflect actual hosting.

Errors: JSON `{error}` with 400/401/403/404/409/413/422/429 or 503; unexpected errors are generic. Read-only health returns `{ok,version,environment,revision,marketplace_enabled}`. Public bootstrap returns `{mode:'server',csrf,user,products,artists,settings}`. Users never contain password hashes. No reusable HTTP install or setup-status endpoint is available.

| Route | Method / access | Input and response |
|---|---|---|
| bootstrap | GET public | active products, public artist profiles, settings, safe session user |
| health | GET public | database readiness and deployed revision |
| state | GET/POST signed-in | cart `{id,variant,qty}` and saved IDs; persist only valid products/options |
| register | POST public | name,email,password,role; only buyer/artist allowed; safe user |
| login/logout | POST public | email/password or no body; session rotation |
| profile/password | POST signed-in | profile name and artist bio/location; current/new password |
| forgot-password | POST public | email; unavailable while mail disabled, otherwise generic queued result |
| reset-password | POST public | token,password; expiry, single-use and session invalidation |
| message | POST public | contact/newsletter,email,name,subject,message; `{ok}` |
| checkout | POST public | customer{name,email,address,city,postal,phone,country},cart,coupon,consent,request_key; `{order,guest_token}` |
| orders | GET signed-in | current account orders |
| order | GET owner/admin or private token | id,token query; unauthorized lookup returns 404 |
| upload/image | POST artist/admin / GET authorized | artwork → upload_id; approved active artwork publicly visible, otherwise owner/admin only |
| studio | GET artist | own products and own order lines, no other customers' shipping addresses |
| artist-product | POST artist | id optional,title,category,price,stock,description,variants,upload_id; optional materials,dimensions,care_instructions,size_guide,gallery_upload_ids (≤6); ownership enforced; returns pending |
| admin | GET admin | products,safe users,orders,messages,settings,recent audit |
| admin-product | POST admin | listing fields,artist_id,status; audit |
| admin-order | POST admin | id,status,tracking; row lock, valid transitions, cancellation restocks once |
| admin-user | POST admin | id,status active/suspended; cannot change admin accounts |
| admin-message | POST admin | id → resolved and audit |
| admin-settings | POST admin | announcement,support_email,shipping,free_shipping,checkout_enabled,coupon_code,coupon_percent; optional delivery_estimate,returns_policy |
| admin-record-payment | POST admin, local/test/staging opt-in only | id,reference; simulated external-payment record, no charge or transfer |
| admin-system | GET admin | DB driver, disabled/enabled mail and queue/paid-order counts |

Checkout validates 1–50 lines, integer quantities 1–20, active products/options and stock; ignores client prices/totals. Prices and configured discounts/shipping are computed in halalas. Products are locked in stable ID order; order idempotency is unique per session/request key and reserved before stock changes. Duplicate checkout returns the same order/tracking token without another stock decrement. The request key's scope changes when the session rotates; do not retry an old purchase after logout/login using a new session. Guest tracking tokens are secret-derived opaque values; imported PHP token hashes continue to verify supplied original tokens.

Product details are optional plain-text strings: materials/dimensions ≤300 bytes, care_instructions ≤1000, size_guide ≤2000. gallery_upload_ids accepts up to six private upload IDs, deduplicated and checked against upload ownership or assignment to the artist's own listing. Gallery images become public only when referenced by an active approved product. Pending images remain accessible to the upload owner, assigned listing artist and administrators. delivery_estimate ≤300 and returns_policy ≤3000 are administrator-managed store settings. Omitted new fields preserve saved values; empty strings/arrays clear them. No additional schema migration is needed for these JSON fields.

Order states: awaiting_payment/new → cancelled; test payment record → processing; processing → shipped/cancelled; shipped → delivered. Paid cancellation sets refund_required; delivered/cancelled are terminal, repeat cancellation does not restock. Real gateway/payment webhooks, refunds, transfers and monthly ledger are not implemented. Existing product royalty snapshot fields are retained for frontend compatibility only.

Frontend CSS/imagery/slideshows remain intact apart from responsive form/confirmation fixes and accurate server/test-payment wording. Existing country choices are retained, but delivery integrations/coverage still require operational configuration. Unconfigured social profiles are not invented. Future OAuth/provider features described in the handoff are not treated as current features or credentials authorization.
