# Validation and remaining deployment prerequisites

Current machine: Node.js 24.19.0, MySQL 8.4 in a localhost-bound Docker database, Express 5. Original seed data is fictional; no production export was imported.

17 integration/configuration checks passed. Four desktop/mobile browser scenarios passed on the current machine.

The existing integration suite exercises actual MySQL queries, transactions and HTTP sessions: CSRF/origin protections; safe registration and session rotation; customer state/profile/messages; role restrictions; image content/dimension/ownership validation; artist submission and admin approval; server-calculated SAR totals/coupons; concurrent idempotency and final-unit stock contention; transaction rollback; manual test fulfillment; concurrent one-time cancellation restocking; checkout pause; suspension; PHP bcrypt verification/rehash; cross-session password invalidation; recovery expiry/single-use; email queue locks with a simulated transport; production landing-page preservation; and concurrent rate limiting. Mock email delivery does not validate a real provider.

Playwright exercises the preserved UI on desktop Chromium and an emulated iPhone viewport: registration, checkout, confirmation/private tracking, artist upload/submission, admin approval and approved storefront visibility. It checks page errors and viewport overflow for the tested pages. A real mobile browser/device is not available; these checks do not establish Safari compatibility. Browser testing found an intrinsic-width sidebar/grid issue blocking artist submission on mobile; the targeted responsive fix preserves the design and allows that workflow to pass.

Migration is exercised twice to confirm repeatability; local initialization/provisioning preserve existing state. Dependency audit reports zero production vulnerabilities at this validation time. The cloud browser download destination was blocked, so browser tests used the machine's installed Chromium; no TLS or artifact checks were disabled. CI installs its own Playwright browser normally.

Hostinger runtime: the user confirmed Node.js 24 is available on their Cloud plan.

Not verified: GitHub/native hosting connection, live staging DNS/TLS/proxy behavior, persistent private hosting storage, hPanel environment/secrets, SMTP delivery, real imported account/order/artwork consistency, production cutover, deployment in a new cloud task or a production release. The user reports a Cloud plan and a Node deployment option; authenticated account/deployment verification remains pending. Hostinger support pages returned 403 from this execution environment.

Neither OAuth, online payments, real refunds, monthly artist payouts nor delivery-provider automation is enabled. The preserved royalty estimate is not a payable balance. Production remains a deliberate release and defaults to the existing coming-soon page.
