# Veelad Fulfillment Phase 3 — Multi-supplier Operations

Phase 3 extends the authenticated /fulfillment workspace. It does not affect /partners, customer payments or production deployment.

## Split manufacturing

Administrator routing allocates every purchased line exactly once to an active supplier with a verified product print template. An order already assigned to one supplier cannot be converted or double-assigned. Separate supplier line jobs protect other factories' artwork, order details and customer information.

Each line follows assigned → accepted → printing → quality_check → packed → dispatch_submitted → dispatched. Printing requires a manually approved line-specific print certification linked to purchased proof snapshots, original file SHA-256 hashes and printing dimensions. Independently approved QC photos and revised packaging signoffs are required before packing and dispatch. Unresolved issues block progress. Only the Veelad administrator can approve final dispatch; the customer order is marked shipped only after every purchased line is dispatched.

## Supplier performance

The Performance view reports job throughput, completion, on-time dispatch where a stored deadline exists, defect-affected lines and average production hours. All supplier views are server-scoped. The dashboard never estimates unrecorded SLA deadlines or leaks retail prices and artist earnings.

## Manufacturing invoices

Veelad administrators create manufacturing invoices from completed, dispatched split product lines. Units are validated against immutable order snapshots. Invoice costs and taxes are integer minor units in supported currencies. Unique lines cannot be invoiced twice. Supplier managers can submit their invoices; only Veelad administrators can approve and record an externally verified bank settlement reference. There are NO bank transfers or automatic payments in Phase 3.

## Integration API v1

Staging base: https://staging.veelad.com/api/fulfillment/v1
Endpoints: GET /jobs, GET /jobs/{line_job_id}, POST /jobs/{line_job_id}/status.
Authorization: Bearer YOUR_TOKEN. A token is displayed once, expires after 90 days, can be revoked, is stored only as its SHA-256 hash and is limited to one supplier and the selected read or status scope. Status tokens may accept, start printing or advance to quality check but cannot approve QC, view photographs, access customer addresses, approve invoices or dispatch products. The API is not an actual Merchlist proprietary integration until Merchlist connects it.

## SLA monitor

The Performance page includes a bounded manual deadline scan. The idempotent CLI entrypoint is scripts/fulfillment-sla-monitor.js. Hostinger cron scheduling is NOT configured by this change. Upcoming and overdue notifications go to the supplier's active members and Veelad administrators; no external unsolicited email is sent.

## Verification and operational rollout

Run npm run check, npm run build, npm test, npm run migrate against an isolated database, then Playwright fulfillment-phase1/2/3 desktop/mobile, plus full repository regression checks. Confirm staging health reports its exact deployed SHA and inspect /fulfillment. Use only fictional staging orders. Independently review physical print/bleed/colour specifications and supplier packing rules before allowing real manufacturing.

Production stays gated by FULFILLMENT_ENABLED and disabled by default. Actual factory contracts, carrier-label purchases, bank disbursements, external API adoption and cron configuration require separate authorized work.
