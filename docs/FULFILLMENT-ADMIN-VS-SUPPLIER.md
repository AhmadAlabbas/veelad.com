# Veelad fulfillment — two separated operational workspaces

## 1. Store manager / Veelad administrator

**URL:** `https://staging.veelad.com/en/admin?tab=fulfillment`

This is the sole **primary management interface** for supplier companies and manufacturing operations. It lives in Veelad's existing admin panel next to Orders, Products, Journal, Pricing, and the rest of the business.

The management section uses existing protected server endpoints and supports:
- Create, suspend and reactivate suppliers such as Merchlist
- Invite verified supplier employees (48-hour, single-use, role-bound) and revoke access
- Assign approved paid orders, inspect their status, reconcile existing Printing-stage test orders with explicit anti-duplicate confirmation
- Configure genuine factory print areas, DPI and bleed, Veelad packaging and supplier deadlines
- Inspect submitted QC photos, approve/reject evidence, sign off approved print preflights
- Approve final customer dispatch and split-product-line dispatch
- Route multi-product orders across several manufacturing companies if needed
- Manage limited API keys and recorded supplier manufacturing invoices

The manager's existing **Production** and **Orders** admin tabs remain responsible for storefront customer proof approval and order payment/admin handling. There is no automatic payment transfer.

## 2. Printing company / Merchlist employees

**URL:** `https://staging.veelad.com/fulfillment`

A supplier employee uses their own email and password on this separate site. Access to customer designs and orders requires a verified, active supplier membership (invitation-based). Their workspace supports only jobs assigned to the employer: order acceptance, approved print files, printing, quality evidence, packing, tracking, issues, and conversations. Suppliers cannot see other companies' jobs, manage supplier accounts, approve customer shipment, or administer the marketplace.

When a Vielad administrator opens this supplier site while signed in, the browser redirects to the manager's fulfillment section.

## 3. Staging manufacturing test

1. Sign in to your Veelad admin panel and select **Fulfillment**.
2. Confirm the Merchlist company exists and is Active.
3. Configure factory-verified print dimensions, DPI, and packaging for each eligible apparel category.
4. In **Orders**, assign one paid order with approved proofs to Merchlist. An order already in Printing requires explicit reconciliation; don't duplicate production.
5. Invite a fictional supplier-employee test account.
6. In a separate browser session, accept the invitation, sign in at `/fulfillment` and walk the job through printing, QC evidence, packing and carrier submission.
7. In your **Veelad admin panel**, review QC evidence, resolve any blockers and approve customer dispatch.

## Safety and release status

- Staging only. Do not share live customer addresses or production secrets with external partners during tests.
- Supplier print specification templates and packaging must match real physical samples before real manufacturing.
- Production fulfillment and live payment processing remain disabled pending the full readiness gates in issue #97.
- A GitHub code merge does not prove Hostinger deployment. Require the exact deployed revision and staging fulfillment smoke checks.
- A supplier API credential is separate from employee login and is not a substitute for invitation-based account permissions.
