# Connected creative experiences

The creative hub connects eight journeys to the existing bilingual marketplace and private editor. It is additive: no production migration, customer payment activation, real bank transfer or supplier integration is implicit.

| Journey | Available behaviour |
| --- | --- |
| Design my story | Private saved briefs, deterministic directions and palette matching, explicit application to editable text layers. This is guided matching, not an AI image generator. |
| Gift studio | Recipient/occasion/mood/budget matching against actual active, available products, reasons, optional private brief saving and editor handoff. Delivery estimates are not invented. |
| Creative universe | Explicitly consented account preferences, versioned changes, saved style/colour/mood and deletion. No anonymous profiling. |
| Artist personalisation | Artist-authored typography compositions, permitted fields/fonts/colours, moderation and immutable customer-owned snapshots. Artist art shown in the source product photograph is not included. Saved designs preserve author credit and royalty snapshot. |
| Collaborative rooms | Invite-only owner/editor/viewer membership; hashed expiring invitations; explicit join; messages; versioned text concepts; voting; owner approval; private editor copy. Polling updates, not simultaneous shared canvas editing. No private original uploads are shared. |
| Wish board | Moderated wishes, authenticated votes/follows, artist responses and review. Expressions of interest create neither orders nor payment obligations. |
| Living stories | Artist inspiration/process, approved product-preview sketches, downloadable QR link, separately consented/moderated customer photo derivatives and withdrawal. No original files are published. |
| Digital sample room | Actual public product previews, inspection/zoom, available gallery views, comparison and an illustrative room composition. Confirmed dimensions and supplier-calibrated colour/fit/print guarantees remain external work; no camera AR claim. |

## Entry points

`/en/creative` and `/ar/creative`, with `story`, `gifts`, `taste`, `templates`, `rooms`, `wishes`, `stories`, `sample-room`, and `workspace` subpages. Administrators review content at `/en/admin?tab=creative`. The homepage and storefront navigation link the hub.

`CREATIVE_EXPERIENCES_ENABLED` defaults to on in local/test/staging; production requires explicit `true`. Explicit `false` disables new creative APIs everywhere. Existing saved personalisation validation remains authoritative during later order handling.

## Persistence and operations

Migrations 011–013 add fifteen tables to the existing 39. All 54 tables participate in encrypted backups and restoration. Old snapshots receive empty additive tables only when their migration manifest predates the new migrations. Missing tables in snapshots claiming those migrations are rejected. Room expiry cleanup is bounded, runs hourly, and never deletes orders or artwork. APIs continue using existing same-origin session/CSRF protection.

Artwork stays in existing private storage. Artist templates use protected text compositions instead of transferring original artist source files into customer accounts. Final designs validate the immutable personalisation snapshot; browser-supplied royalty metadata is never authoritative. Existing customer-created artwork keeps its original private ownership behaviour.

## Validation

Focused desktop/mobile browser checks cover taste consent/deletion, real budget-constrained recommendations, guided editor handoff and private saving, wish moderation, room invitation privacy/member removal/approval, protected artist personalisation and the shared workspace navigation. Broader backend and browser checks are recorded with each reviewed release. Screenshots use synthetic fixture accounts. Chromium mobile emulation does not establish real Safari or physical print accuracy.

## Before commercial expansion

Publish real artist templates and stories after review; empty community pages are intentional until submissions exist. Review content rights and programme wording. Arrange supplier measurements and printed samples before claiming calibrated production previews. Complete the existing live payment, fulfillment and refund integration independently. AI-generated image creation and simultaneous multi-user canvas editing are future capabilities, not hidden dependencies or claims of this release.
