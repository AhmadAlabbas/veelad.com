# Veelad Fulfillment workspace

The fulfillment workspace is part of the existing Veelad Express/MySQL application at `/fulfillment`. It is **not** the affiliate program (`/partners`). It provides restricted, audited access for printing/manufacturing partners such as Merchlist.

## Deployment controls

- Enabled by default on **staging only**; set `FULFILLMENT_ENABLED=false` in staging to disable the routes.
- Disabled by default in production. Explicit `FULFILLMENT_ENABLED=true` plus a reviewed production release is required.
- All views and files require the existing logged-in, active Veelad account. Membership is *additional* authorization; a buyer or artist account is not automatically a supplier employee.
- No default suppliers, user invitations, demo orders, passwords or sample addresses are seeded.
- The change is additive. Migration `zz-20261103-fulfillment.json` creates `fulfillment_suppliers`, `fulfillment_members` and `fulfillment_jobs`. Backups and staging restore rehearsals include these tables.

## Administrator setup on staging

1. Visit `https://staging.veelad.com/fulfillment` using an administrator account already registered with Veelad.
2. Choose **Suppliers**, then create **Merchlist**. Use the actual verified supplier identity before using real fulfillment operations.
3. Ask each authorized employee to register their **own** Veelad account and sign in once. Grant access by email under **Employee access**. Suspend access immediately if an employee leaves. Users cannot register with role `supplier` publicly.
4. To test the workflow, use an entirely fictional staging order. Complete its test-payment state through the existing *staging-only* administrator control, upload/review and approve each final proof, and complete the originals/placement/options preparation checklist. Only then can the order appear in the assignment pool.
5. Assign the eligible order to a supplier. The supplier can accept it, start printing, mark quality checks passed, confirm packaging, and submit carrier/tracking details. In the current release an administrator must approve final dispatch before the customer order changes to `shipped`.
6. Download the **per-line** manifest, original artwork, or composed PNG through the authenticated workspace. Each file is derived from the immutable order snapshot, not the current product listing. Verify product-specific actual printable dimensions, bleed, placement, colour and physical samples with the supplier; current layouts are **provisional**, not certified manufacture files.

## Roles and data access

- Supplier employee: list/open only assigned jobs for their active supplier membership. Check production status and access order-line files only after payment and final proof approval. Shipping contact/address is exposed only after packing and only for the assigned order.
- Veelad admin: create/suspend companies, grant/suspend memberships, assign ready orders, inspect all jobs and approve dispatch. Existing admin functions continue to manage proof approval, payments, refunds and order cancellation.
- Customer, unaffiliated artist or ordinary shopper: no supplier jobs, files, shipping addresses or assignments.
- Neither supplier job API nor manifest exposes retail prices, artist payouts/commissions, internal administration notes, financial references or unrelated orders.
- Every write and file export uses the existing CSRF/session protections and audit log. All relevant supplier queries are checked against server-side membership. Shipping never relies on a client-supplied supplier ID to authorize an assigned order.

## Production controls

The initial design assigns a whole order to a single supplier. A future version can split jobs by immutable order line; the current release **must not** assign one order to two suppliers. Production action sequence:

`assigned → accepted → printing → quality_check → packed → dispatch_submitted → (Veelad administrator approval) → shipped`

Supplier work can be placed `on_hold` with a note and resumed to its prior stage. Irregular transitions are rejected. Current approved proof status, preparation checklist, payment status, order status and optimistic revision are checked on the server. Supplier status updates cannot change order prices, stock, payment statuses or artist royalties.

## Remaining launch requirements

This first functional version does not create supplier accounts from invitations, call Merchlist's proprietary API, purchase shipping labels, certify print dimensions, calculate supplier invoices, support per-line split manufacturing, or automatically reconcile provider tracking. Confirm with Merchlist that the file formats, packaging rules and carrier tracking process satisfy its factory workflow **before handling real customer orders**. Perform physical-device browser QA and a staging-to-production release review.

## Validation

Run `npm ci`, `npm run migrate` on a disposable local/test DB, `node --test tests/fulfillment-core.test.js`, `npm run check`, `npm test`, `npm run build`, and the existing Playwright suite. Do not run integration tests against staging or production databases. Verify that the staging URL reports its exact deployed SHA before declaring deployment complete. Preserve the current app deployment gates in `docs/DEPLOYMENT.md`.

## Phase 1: supplier security, print preflight, QC and issue handling

**New supplier employee onboarding**

1. An authorized Veelad administrator opens **Fulfillment → Suppliers** and selects the supplier company.
2. Under **Invite supplier employees**, enter the *exact intended employee email* and choose **viewer**, **operator**, **QC reviewer** or **manager**. The unique invitation is valid for 48 hours, hashed in the database, and one-use.
3. If staging email delivery is allowlisted and configured, the invitation is queued. Otherwise, copy the one-time link and share through an authenticated private channel. Never send invitations to a public group.
4. The employee signs in with their own Veelad account, verifies its email, enrolls a personal authenticator, and accepts the invitation. Returning members must enter a new authenticator code for each new session and after the eight-hour supplier step-up expires.
5. Admins can revoke pending invitations, change roles, and suspend memberships. Roles are enforced on the server, not just hidden in the interface. Existing directly granted supplier members default to **operator** until assigned a specific role.

**Role policy**

- Viewer: view assigned order status, non-sensitive production details, QC evidence and issue history; no raw artwork or writes.
- Operator: download approved artwork, accept and print jobs, upload QC photos, report issues, pack and submit dispatch; cannot approve QC or resolve issues.
- QC reviewer: upload QC photos and sign off alignment, colour and finish; cannot manufacture/pack or resolve issues.
- Manager: all operational permissions and issue resolution.
- Administrator: company invitations, roles, supplier-confirmed print specifications, pack approvals, and dispatch approval.

**Authenticator design**: Standard time-based six-digit codes (TOTP), AES-256-GCM encrypted seeds using a key derived from the staging session secret, replay rejection, eight-hour step-up, and rate limiting. Individual accounts only. No SMS recovery or bypass link is implemented. Hostinger must preserve a stable \`SESSION_SECRET\`, and account recovery must be an audited administrator-run process after identity verification; changing the secret without a migration can make enrolled authenticators unusable.

**Print-specific release gates**

1. Obtain *actual printer specifications* from Merchlist for each product category. Under **Supplier print specifications**, record maximum width/height in millimetres, required DPI and bleed. Admin confirms each setting; **no default physical dimensions are presumed**.
2. Each assigned order has a print preflight comparing validated original pixel dimensions and formats against those confirmed supplier specs. Any missing master, unapproved spec or insufficient source resolution fails the check. The preflight is deliberately conservative for maximum-size placements; text-only designs without a saved certified original remain blocked.
3. After checking the exact purchased design/order snapshot, a Veelad admin approves the passing report. The approval is hashed over the purchased lines, supplier specification revisions, and original bytes. Changes invalidate it.
4. The employee downloads one approved ZIP containing exact originals and \`print-job.json\`. Customer addresses, pricing, financial information and artist royalties are excluded. Printing and supplier original exports are blocked until the current pack is approved.

**Production quality evidence and issue escalation**

- The operator uploads up to **six** PNG/JPEG photos per line (each <=8 MiB). The server validates and normalizes each image, strips EXIF/location metadata, and saves it in Veelad's private original storage with database records and encrypted backup coverage.
- Before progressing to quality-check completion, every purchased line needs photographic evidence. A QC reviewer/manager/admin must explicitly approve placement, colour and finish. New photos clear the existing QC review.
- Creating a categorized issue pauses the supplier job. An admin or supplier manager records a resolution. The job stays on hold until explicitly resumed, and outstanding issues block resuming, QC completion, packing and final dispatch.
- Customer order status and financial fields remain controlled by the existing Veelad administrator workflow.

**Staging acceptance checks**

- Use fictional staging orders only. Test employee onboarding using an invited, email-verified account with a separate authenticator.
- Confirm that unverified or expired invitations, reused TOTP codes, suspended suppliers, revoked members, and viewer attempts to download artwork are rejected.
- Test print specs, insufficient-resolution warnings, approval, ZIP extraction and invalidation after a spec change.
- Upload QC photos of test items, verify no EXIF, verify required per-line photos and QC signoff, report and resolve an issue, then complete packaging/dispatch under admin approval.
- Run the unit and browser regression suites and confirm the exact staging commit in \`/api.php?route=health\` before declaring release. Production remains disabled until a separately reviewed production release.

**Dependencies for real Merchlist orders**: A real supplier agreement specifying manufacturing dimensions/formats/bleed, physical sample sign-off, packaging/label requirements, operational ownership, and shipping integration. The software cannot invent or certify factory-specific parameters or actual samples. Photo evidence demonstrates inspection but is not a substitute for factory certification.
