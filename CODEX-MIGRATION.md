# Veelad: Codex migration handoff

This package contains the user's actual Hostinger file snapshot, uploaded 14 October 2026 (Saudi time). It is PHP source prepared for a Node.js rewrite, NOT an already migrated Node.js application.

## Environments
- staging.veelad.com: testing marketplace; source public_html/staging/.
- veelad.com: production; currently a coming-soon page in public_html/ outside staging/.
- veelad-app/: private PHP backend and artwork storage, originally beside public_html/.
- Preserve the production coming-soon page while developing/testing. Never deploy to production merely because staging tests pass.
- Hostinger Node.js runtime/deployment support must be verified for the user's actual plan; the earlier demonstrated PHP hosting resources do not establish Node.js support.

## Package handling
- All supplied files are retained byte-for-byte EXCEPT private veelad-app/config.php and the empty DO_NOT_UPLOAD_HERE marker, which are excluded.
- config.example.php is newly supplied with placeholders only.
- Hostinger default.php files are preserved as reference; they are not application entry points and should not be ported.
- No SQL export was supplied. seed.json contains sample catalog data, not real accounts/orders. Existing uploaded artwork requires its uploads table records to retain ownership and product associations.
- Original PHP source remains useful as the reference implementation. Do not overwrite the live PHP deployment during the rewrite.

## Business and visual requirements
Veelad initially serves Saudi Arabia, uses SAR, and is inspired by an artist print-on-demand marketplace. Artists upload original designs; Veelad sells, produces and delivers products. Artists earn an undecided percentage and receive monthly payouts. The payout ledger and operational workflow remain to be built; do not treat existing demo royalty displays as completed payouts.
Preserve the current white-background, black-navigation/footer design, colorful product imagery, slideshows and animations. Preserve existing frontend behavior first; visual redesign is not requested in this handoff.

## User-reported staging checks
User reported successful checkout, customer registration, artist upload/submission/admin approval, manual test-payment recording, processing/shipped/delivered updates, cancellation and stock restoration, role access checks and account suspension, coupon calculation and checkout disabling. These are user reports, not an independent production audit.
A mobile tracking-page overflow fix was appended to styles.css; the user says a minor layout issue remains and deferred it. Email/contact tests were skipped; email delivery and password recovery remain unverified. Installer files were removed from the uploaded snapshot.

## Existing implementation
Buildless HTML/CSS/JavaScript SPA with hash routing, frontend assets/app.js and assets/data.js; PHP JSON API public_html/staging/api.php; PDO/MySQL core/schema in veelad-app/core.php. MySQL tables: users, artists, products, orders, settings, messages, rate_limits, uploads, customer_state, password_resets, mail_queue, audit_log.
Inspect the API, core and frontend before modifying. Port all existing API behaviors or explicitly document a compatible endpoint adapter. Current routes include bootstrap, health, state, register/login/logout, profile/password, forgot-password/reset-password, message, checkout, orders/order, upload/image, studio, artist-product, admin, admin-product, admin-order, admin-user, admin-message, admin-settings, admin-record-payment and admin-system. Setup/install routes need a safe replacement provisioning process rather than an exposed reusable installer.

## Migration requirements for Codex
1. Inventory the supplied code and document API contracts/schema. Create a runnable Node.js project with package.json, lockfile, environment example, README and meaningful tests. Choose and explain a maintained Node.js version/framework using current official documentation.
2. Prefer retaining MySQL and existing frontend initially to reduce migration scope. Use schema migrations and prepared queries. Add a documented import path if a database export is later provided. Do not invent missing production data.
3. Preserve secure cookie sessions, session rotation, CSRF/origin protections, role checks, suspension checks, rate limiting, password-reset token expiry/single-use, audit logging and private upload ownership. Implement actual server-side enforcement.
4. Existing password hashes are PHP password_hash values. Inspect algorithms before migration and implement compatible verification/rehashing or a documented reset strategy; never silently discard working accounts. Existing PHP sessions need a clear re-login transition.
5. Preserve server-calculated totals, option validation, inventory transaction handling, order idempotency, cancellation restocking exactly once and private guest tracking. Manual external-payment recording is not an online payment gateway.
6. Keep uploads private until product approval. Validate file contents/size/dimensions and preserve ownership mappings. Do not expose the entire uploads directory publicly.
7. Replace PHP mail worker with a Node.js queue worker; add provider configuration only when selected. Mark unavailable email features honestly.
8. Run meaningful integration tests covering authorization, checkout concurrency/idempotency, stock rollback/restoration, and uploads. Check desktop/mobile layouts, especially long order IDs and status badges.
9. Produce a staged Hostinger deployment/runbook with environment variables, database migration, worker scheduling, backups, rollback and HTTPS/session configuration. Verify hosting runtime before promising deployment.
10. Keep staging and production secrets/databases isolated. Do not commit real config.php, environment secrets, database exports or private customer data.

## Requested future features (not implemented yet)
- Google sign-in first; Apple sign-in later, with provider credentials/setup required. Validate identity tokens server-side; handle account linking securely; social login must never grant administrator access. Artist onboarding should follow authentication.
- Shared storefront footer: Instagram, LinkedIn, X, YouTube. URLs not supplied; hide unconfigured links rather than inventing profiles.
- Online payments: no provider account selected. Moyasar and Tap were discussed, not approved or integrated. Confirm provider acceptance of Veelad's production/delivery and monthly artist royalty model. Use server-side payment verification and authenticated webhooks with duplicate-event handling.
- Monthly artist royalty ledger/payout workflow; percentages and calculation basis undecided. Snapshot agreed rates per order, handle discounts/refunds/cancellations, distinguish pending/eligible/paid amounts and record transfers to avoid duplicate payouts. Do not execute real transfers without an authorized provider/account setup.

## Suggested initial Codex prompt
Read CODEX-MIGRATION.md and the supplied source. Rebuild the PHP backend in Node.js while preserving Veelad's frontend, MySQL data model and tested behavior. Start by inspecting the code, then implement a runnable local version and test the main customer, artist and administrator flows. Keep staging.veelad.com as the test environment and veelad.com as production. Do not deploy or enable real payments yet. Document missing credentials, absent database data and Hostinger runtime requirements.
