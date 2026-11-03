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
