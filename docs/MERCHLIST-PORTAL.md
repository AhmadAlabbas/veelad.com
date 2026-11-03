# Merchlist manufacturing portal — staging release candidate

URL: https://staging.veelad.com/fulfillment

The portal is a private supplier workspace. It is NOT the public storefront or the affiliate partners portal. It uses supplier-scoped existing Veelad accounts, but has its own email/password sign-in and invitation-based signup interface. No password is shared with Veelad administrators or other suppliers.

## Merchant onboarding
1. A Veelad administrator signs in at /fulfillment and opens **Suppliers**.
2. Create an active company named **Merchlist**. For staging automatic routing, there must be exactly one active company with that name unless FULFILLMENT_DEFAULT_SUPPLIER_ID is explicitly set.
3. In **Secure supplier invitations**, invite an employee by exact work email and choose manager, production or quality role.
4. Share the one-time URL securely. It is valid for 48 hours, single-use. In staging there is deliberately no outgoing invitation email.
5. The employee opens the link, creates a supplier email/password account **inside /fulfillment** (12–128-byte password), or signs in with their existing account. The invitation gives permission only to the selected supplier, and only assigned work is accessible.
6. Assign independent employees for printing and QC: self-approval of final-print photographs is not permitted.

## Order flow
- A newly verified paid **processing** order must have final approved customer proofs, checked originals/placement/options and production stage **Ready**. Once Ready and with a single active Merchlist supplier, a transactionally idempotent staging hook creates the supplier job and notifies the supplier team. This runs after the payment and/or proof-readiness updates.
- If the supplier company was registered **after** an order became Ready, old orders are NOT silently backfilled. Admins can manually assign them on **Suppliers → Assign an approved order**.
- Legacy paid, approved orders already at **Printing** in the customer admin can also appear in that manual assignment pool; an explicit warning and confirmation is required so a job is not duplicated. Existing supplier/split routing is never overwritten.
- Jobs use **assigned → accepted → printing → quality_check → packed → dispatch_submitted**. QC evidence, fingerprint-bound print-preflight signoff and supplier-specific packaging rules protect progression. Merchlist submits carrier and tracking; **Veelad admin approves final dispatch** and marks the customer order shipped.
- Staff see the dashboard, supplier orders, printing, QC, packing, shipping, print files, messages, product lines, alerts and analytics. Administrators retain restricted supplier setup, routing, API keys and manufacturing finance tools.

## Deployment and safety
- Staging enables FULFILLMENT_AUTO_ASSIGN_ENABLED by default unless explicitly set false. It auto-selects exactly one **active** Merchlist company; no assumed supplier ID or silent assignment across competing companies.
- Production remains disabled by default. Enabling there requires BOTH FULFILLMENT_ENABLED=true and FULFILLMENT_AUTO_ASSIGN_ENABLED=true, PRODUCTION_MARKETPLACE_ENABLED=true, and an explicit FULFILLMENT_DEFAULT_SUPPLIER_ID for a company named Merchlist. Test payments never enter production fulfillment.
- Existing/actual physical print templates, sample colours, packaging, carrier service, supplier agreement, privacy/security review and off-host backups must be verified before real orders. The portal is **not** a proprietary Merchlist API integration and does not purchase shipping labels.
- Staging must use test orders and controlled artwork. Never share customer addresses or paid production data with outside suppliers during tests.
- Code merging does NOT by itself verify Hostinger deployment. Require full CI plus exact deployed SHA and /fulfillment smoke check.

## Known out-of-scope items
Supplier-owned password-reset UI (public recovery requires configured email), automatic invitation email to third parties in staging, automatic legacy Printing backfill (deliberately avoided), real carrier integration, supplier payouts, and launch payment processing.
