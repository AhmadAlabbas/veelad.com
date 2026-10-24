# Creative experience review

This review concerns the connected creative hub, guided briefs, gift discovery, taste preferences, collaborative rooms, moderated community requests, artist personalisation, design stories, and digital sample room. It does not authorise production activation or establish physical print accuracy.

## Acceptance evidence

Use the committed automated checks and the release's validation results together. The browser suite uses disposable databases and synthetic users through `tests/helpers/google-app.js`; it does not write to staging or production accounts. Desktop Chromium and an iPhone-size Chromium viewport are covered. Real Safari testing remains separate.

| Experience | Required behaviour |
| --- | --- |
| Guided story brief | A real saved brief produces an explicitly template-based, editable design direction. Applying it requires an affirmative action; existing work is preserved or replacement is confirmed. |
| Gift studio | Recommendations refer to existing active, available products and respect the budget in integer SAR minor units. Empty results explain how to widen the search. |
| Taste profile | Preferences are optional and persist only after explicit consent. Customers can adjust or remove them; anonymous browsing does not create a profile. |
| Shared design room | Invite acceptance is explicit, expires and can be revoked. Nonmembers cannot read room content. Editing uses versions; voting is per member; only the owner approves the final direction. |
| Artist personalisation | Published templates have reviewed licensing and controlled editable text. Saved designs preserve their source version, locked composition and authoritative artist attribution. |
| Wish board | Customer proposals and artist concepts are moderated before public visibility. Votes and follows require an account and cannot be multiplied by repeated requests. |
| Design stories | Public pages show reviewed content attached to actual available products. Customer photos require explicit consent and review, can be withdrawn, and use bounded previews rather than original-file downloads. |
| Digital sample room | Controls use actual supported views and variants. It distinguishes provisional composition from calibrated measurements; zoom does not claim higher native resolution. |

## Security and data integrity review

- User text is escaped at HTML boundaries. Product identifiers and internal URLs are constructed from validated records; user-supplied SVG or HTML is not inserted as markup.
- Public DTOs exclude account email addresses, private file paths, original artwork payloads, invite hashes and internal moderation notes.
- All changing requests use the existing authenticated session, same-origin and CSRF checks. Invite landing requests do not join a room or change votes.
- Template restrictions are enforced against authoritative server data when saving both drafts and final customer designs. Browser-only locks are insufficient.
- Personalisation must retain its authoritative artist/royalty snapshot at checkout. Applying an artist template must not silently classify it as an unrelated customer-original design.
- Concurrent edits use version checks. Duplicate votes, follows and invitation acceptance are constrained transactionally.
- New creative tables belong in encrypted backups and restoration rehearsals. Compatibility with older snapshots must depend on migration history; missing tables in a snapshot claiming the new migrations are corruption, not empty content.

## External prerequisites and honest limits

Guided concepts are curated/template matching unless a real generation provider is configured. No AI-generation success, live bank transfer, payment capture, physical-product certification or photorealistic print guarantee is inferred from a successful preview.

Artist agreements must establish real marketing/personalisation permissions and royalty obligations. Supplier specifications and physical printed samples are still needed to calibrate printable areas, colour reproduction and product dimensions. A room/background composition is not camera-based augmented reality. Preorder money collection remains separate from nonbinding wish-board interest.

Public staging content should not be populated with invented customers, testimonials, votes, earnings or artist stories. Screenshots and tests may use clearly isolated synthetic fixtures.
