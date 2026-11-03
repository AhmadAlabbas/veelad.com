# Veelad Fulfillment — Phase 2 Operations

Phase 2 expands the private `/fulfillment` workspace. It does not modify the affiliate `/partners` portal or enable fulfillment on production.

## Features delivered

**Packaging centre.** Veelad administrators define supplier/category-specific packaging containers (mailer, box, tube, other), detailed instructions, mandatory inserts, and whether independently approved packaging photos are required. Each policy is revisioned. The assigned quality reviewer or administrator signs the six-point packaging checklist at `quality_check`; a mismatched policy/order snapshot, missing category rule, or missing required approved photo blocks `packed`, supplier tracking submission and final administrator dispatch.

The `fulfillment-packing-slip` route provides a printable, authenticated internal picking sheet with the assigned order's products and approved packaging rules. It is **not** a carrier label. Recipient addresses are restricted until the order is packed.

**Supplier operations and SLA.** Administrators specify acceptance, production, and dispatch deadlines in elapsed hours from order assignment, in chronological order. New assignments snapshot those deadlines, while pre-existing orders stay unscheduled until an administrator explicitly sets their deadlines. The workspace displays overdue and within-six-hours alerts. There is no unapproved fabricated SLA or automatic rescheduling.

**Private order conversations.** Supplier staff with active membership and Veelad administrators can message each other on assigned orders. Optional JPEG/PNG image attachments are stripped of EXIF metadata, limited to 8 MiB, saved in private backed-up storage, and can be accessed only through an assigned-order authorization check. No generic public files, URLs, or customer chat are exposed.

**In-app alerts.** An assigned job, production stage change, reported issue, QC decision, shipment exception, new message, or administrator deadline update creates a concise notification for the involved supplier's active employees and Veelad administrators. Users can mark their own alerts as read. Deadline calculations refresh when the workspace is opened. **Phase 2 does not send unsolicited third-party email or push notifications**; staging outbound email remains deliberately restricted.

**Shipping desk.** Carrier and tracking references are submitted through the existing reviewed dispatch workflow. Staff can record courier handoffs, delivery exceptions, and verified manual status notes. These are auditable operational events; they do **not** purchase carrier labels, integrate a shipping API, or automatically mark customer orders delivered. Only authorized Veelad administrators can approve dispatch and mark the customer order shipped.

**Bulk operations.** Authorized production operators, supplier managers and Veelad administrators can accept up to 20 assigned, up-to-date jobs in an atomic transaction. Payment, proof approval, supplier membership, order state, open issues, and optimistic revision are rechecked for every selected job. CSV picking-list export includes products/quantities only, excludes PII/prices and escapes spreadsheet-formula characters.

## Deployment and security

- Phase 2 is additive and depends on Phase 1. Its migration is `zz-20261105-fulfillment-phase2.json`, and all seven new tables are included in encrypted backups/restore rehearsals.
- Every supplier route enforces existing authenticated sessions, CSRF, per-account upload limits, active membership, scoped job lookup, and auditing; admin policies are server-authorized.
- Supplier accounts are independent from affiliates. No new subdomain or hosting app is required.
- Production remains gated by `FULFILLMENT_ENABLED`, disabled by default outside staging.
- Never put real customer payment data, artwork or contact information into staging. Use fictional supplier accounts, fictional orders and controlled test files.
- Before handling live orders: verify actual Merchlist packaging and print specifications, shipping handoff protocols, service-level agreements, partner permissions, privacy/security, and physical QC results.

## Verification

Run `npm ci`, `npm run check`, `npm run build`, `npm test`, `npm run migrate` with a test MySQL database, `npx playwright test tests/browser/fulfillment-phase1.spec.js tests/browser/fulfillment-phase2.spec.js --project=desktop --project=mobile`, and the repository's existing full browser suite. Browser tests must not run against staging or production databases.

Only promote the feature branch after **passing relevant validation** and an explicit review of any unrelated full-suite CI failures. Confirm the deployed commit from `/api.php?route=health` and verify `/fulfillment` after Hostinger applies the staging revision.

## Deliberately deferred to Phase 3 or provider integration

Automated carrier label purchase/tracking APIs, multi-supplier line-level splitting, external supplier invoicing, customer delivery auto-confirmation, automated email/push, and a scheduled background deadline monitor are **not** implemented in this release.
