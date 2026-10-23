# Veelad Partners implementation contract

Work on `feature/veelad-partners`. Existing buyer/artist/admin roles are preserved; affiliate membership is an additive profile keyed by `user_id`.

## Module boundaries

- Application: `src/app.js`, configuration, server/worker integration, backups, final integration.
- Finance: `migrations/008-partners-finance.json`, `src/partners-finance.js`, finance unit/integration tests.
- Operations: `migrations/009-partners-operations.json`, `src/partners.js`, applications, approvals, links, consent/attribution, public stores, reports, notification helpers.
- Payouts: `migrations/010-partners-payouts.json`, `src/partners-payouts.js`, encrypted IBANs, manual evidence/reconciliation workflow, campaigns/rules APIs via finance helpers.
- UI: `public/assets/partners.js`, `partners.css`, `public/index.html`, `src/pages.js`, `public/assets/navigation.js`, necessary small `public/assets/app.js` route/render/nav changes.

## Shared routes and dependencies

`partnerRoute(ctx)` and `partnerPayoutRoute(ctx)` return `true` when handled and `false` otherwise. Context: `{route,method,v,req,res,db,c,me,role,throttle,audit,queue}`. Existing API CSRF/origin/session middleware protects these routes. Dispatch before ordinary admin role branching. API endpoints use `partners-`, `admin-partners`, and `admin-partners-` names. Feature flag `c.partners.enabled` defaults on for staging review only when `PARTNERS_ENABLED` is unset; explicit `false` disables it. Other environments, including production, default off and require explicit `true`. Public feature status route `partners-public` remains accessible for an honest disabled landing page. New partner activity requires the flag. Administrator setup, consent withdrawal and historical financial reversals retain their independent access and accounting requirements.

The application mounts GET `/r/:code` through `partnerReferral(req,res,{db,c})` before session middleware. It safely redirects to an internal localized consent page without setting a cookie or creating a click. Explicit consent is a CSRF-protected API action, which may issue the separate opaque, HttpOnly optional referral cookie. The necessary store session remains separate. Never accept arbitrary client affiliate IDs in checkout.

Operations exports `resolvePartnerAttribution({db,c,req,user,items,coupon,customerEmail,conn,dryRun})` returning `{attributions,discount,lineDiscounts}`. `attributions` is an object keyed by immutable order `line_id`, values `{affiliate_id,link_id,campaign_id,channel,coupon_id}`. `discount` is null when no affiliate coupon applies, otherwise an integer total basket discount. `lineDiscounts` records exact item-scoped coupon allocations. Enforce linked-product scope, current approved affiliate, expiry, self referral, optional consent, active campaigns. Coupon precedence is configurable, with an eligible coupon taking priority by default. Last eligible click is deterministic per product. `dryRun:true` performs no budget or use-count writes and backs the authoritative checkout quote. Refusal still navigates to the product without attribution and revokes the optional tracking state.

Finance exports `capturePartnerOrder(db,c,{orderId,userId,email,items,discount,shipping,attributions,lineDiscounts},conn)` inside the checkout transaction after authoritative order lines/prices. Rates and costs are snapshotted then; missing verified costs or agreed artist terms prevent earning eligibility. `syncPartnerOrder(db,c,orderId,conn)` runs after existing payment/order transitions, and `runPartnerMaintenance(c,db)` performs idempotent scheduled processing. Existing manual payments are test only and must never make commissions payable. No real payment webhook exists; document the blocked live gateway integration rather than creating a fake endpoint.

Operations receives immutable `items` incl `line_id`, `id`, `artist_id`, `price`, `qty`, `royalty_percent`, `category`. Financial values integer halalas (minor SAR units), rates basis points. No floating point currency math. Artist royalties cannot be spent as platform funds. No new gateway or bank transfers.

The frontend uses existing global `api`, `user`, `mode`, `money`, `esc`, `currentLanguage`, `url`, `go` where available; `window.VeeladPartners` exposes async `render(route,params)` and `init()` integrated in render. Routes `partners`, `partners/apply`, `partners/dashboard`, `partners/products`, `partners/links`, `partners/payouts`, `partners/store/:username`, `partners/terms`, `partners/privacy`, `partners/referral`, `admin?tab=partners`. Localized `/en/…` and `/ar/…`, also `/partners`.

All changes additive. Never commit real credentials, personal bank details or fabricated business prices/rates. Program defaults disabled, default commission 0, products ineligible until reviewed, payout automation absent. No production deployment in this task.
