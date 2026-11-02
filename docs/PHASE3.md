# Phase 3 — Artists, affiliates, and operations

Scope from the agreed roadmap: artist storefronts, moderated artwork submission, artist earnings, affiliate referrals and commissions, and order/fulfillment operations. This phase builds on the existing modules in staging and does **not** include the pending Phase 2 option-handoff PR.

## Increment 1 — creator reporting and operations triage

- Artist overview shows actionable counts by draft, changes requested, pending review and published status, linking to the existing permissioned product lists.
- The artist sales endpoint derives **owner-scoped** commercial order facts from authoritative order lines. Samples, simulated inventory, cancelled orders and other artists are excluded from commercial order values. Payment status remains a recorded status, not verified bank receipt.
- Artist earnings no longer displays the placeholder 20% royalty computation as a collectible amount. There is no artist royalty ledger or proven settlement balance, so the earnings workspace explicitly declines to show a payable balance or start a payout.
- Administrator production board shows review queues using existing recorded proof, payment and stage metadata. No stage progression, notification or banking action is added.
- All report views are read-only; tests verify owner scoping, sample exclusion and financial disclaimers. English, Arabic and Simplified Chinese labels are included.

## Already implemented in staging before this increment

Artist shop profiles, private drafts and following; moderated product submissions; consent-driven partner referrals, commission accounting and manual payout evidence controls (behind launch gates); order proofs, customer approvals and production tracking.

## Remaining Phase 3 work

1. Contract-approved **artist royalty ledger** with immutable accruals, explicit refunds/returns, reversal entries, and authoritative payment verification. Never assume the compatibility royalty percentage is an agreed rate.
2. Artist payout eligibility, IBAN controls, period closing, maker/checker approvals and actual external transfer reconciliation. Do not enable bank payments before review and evidence.
3. Fulfillment provider adapter, order submission idempotency, print-file reconciliation, shipping webhooks and exception recovery, once provider contracts and live credentials are approved.
4. Complete partner activation after reviewed commercial rates, legal/tax configuration, risk policies, test coverage and explicit launch gate.
5. Test existing and new features on staging with a verified health revision and real protected account flows. Do not claim a full Phase 3 release based on source code or local tests alone.

Production remains unchanged.
