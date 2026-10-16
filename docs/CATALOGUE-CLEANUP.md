# Staging catalogue cleanup — 16 October 2026

The owner requested catalogue cleanup after approving the twelve new sample products. The public staging audit found 29 listings: twelve approved collection products, twelve curated starter products and five older uploads. Four of the older uploads contain placeholder titles and descriptions. No genuine duplicates were found; separate product types using the same artwork remain distinct listings.

The reviewed plan archives these four placeholder listings:

| Listing | Previous title | Category |
| --- | --- | --- |
| `p-00ad0243a689a17e00ba614cdc660bea176128be` | test | Stickers |
| `p-16134533a6be95b04aaf2f05401c8bc7461f295c` | test | Art prints |
| `p-c3710e70dad6d60671963db1` | test test test | T-shirts |
| `p-ecd6f47535fdbd5c90c8cff0` | test d | Art prints |

It preserves the named Mona Lisa upload, every curated starter product, and all twelve approved collection products and their sample prices. The expected public catalogue after cleanup contains 25 listings.

The collection's existing public artist profile becomes **Veelad Studio / استوديو فيلاد**, with the initials VS and a short bilingual collection biography. Its existing identifier and handle remain unchanged, so product links and artist-page URLs continue to work. Authentication account names, passwords, email addresses, roles and Google identities are not changed.

## Deployment and safeguards

`src/catalogue-cleanup.js` runs after staging schema initialization and the existing collection installation/publication check. It accepts only `APP_ENV=staging` and `APP_ORIGIN=https://staging.veelad.com`. Production, local and test startup cannot apply it. No public cleanup endpoint or additional secret is introduced.

`data/catalogue-cleanup-2026-10-16.json` names only the four reviewed listing IDs and one public profile. Each listing must still be active and match a SHA-256 fingerprint of its complete public projection, including its owner, price, stock, artwork identifiers and creation time. Edited, reassigned, missing or already archived targets are skipped. Private production notes and design placement data are preserved verbatim. This is a reviewed correction, not a recurring search for words such as “test”.

A literal database advisory lock and one transaction protect the changes. Only listing status and the exact matching public profile data are updated. Original files, upload records, reviews, order snapshots and mail queues are retained. No artist notification or test email is sent.

The completion journal lives in the backed-up `settings` row `catalogue_cleanup:2026-10-16`. It contains the plan fingerprint, result counts and exact before/after records for each change. Repeated deployments and restores containing this journal do not repeat the cleanup or undo later administrator edits. Changing the reviewed plan after completion is rejected. A bounded status copy appears in authenticated system operations; failures do not take down storefront readiness and are retried on the existing staging maintenance interval.

## Review and rollback

Review archived listings under **Administrator → Products → Archived**. They can be edited and reactivated through the normal administrator controls; a later redeployment will not archive them again once the journal records completion. Archiving removes the public product and sharing pages while retaining the records needed by existing orders.

An application rollback does not automatically reverse these data changes. If the public profile must be restored, an administrator can use the journal's original profile record; compare the current record to the journal's after-state first to preserve later changes. Keep the completion journal. A full data rollback should restore database and private artwork together from the selected encrypted backup, following [DEPLOYMENT.md](DEPLOYMENT.md). Production promotion remains a separate release.
