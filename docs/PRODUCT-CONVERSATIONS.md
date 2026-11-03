# Veelad product conversations (MVP)

**Purpose:** Put moderated, bilingual questions and discussion on each published product page. This is a community feature, **not** an average star-rating system, a verified-purchase review feed, or an endorsement of product fit/print quality.

## Experience

- Every public product page has a **Questions & conversations / التعليقات والأسئلة** section, after the product narrative and before related discoveries. No comments are invented or seeded.
- Guests can read approved comments; a registered, active account is required to post, reply, report, or delete one's own comment. Login links return to the original product.
- Customers, artists, and administrators use the same moderated API. Artist replies on their own listings carry an **Artist** badge; administrator replies carry a **Veelad team** badge. Neither badge implies a verified purchase.
- New customer/artist posts start **pending**. The user sees confirmation, and only approval makes the comment public. Administrator posts may publish immediately.
- Replies are limited to one level, to approved root comments on the same live product. User-owned comments can be deleted, removing their body and public visibility.
- Reports are available for approved comments. One report per account/comment prevents repeated flagging; every report is retained privately with moderation resolution, and reporting one's own comment is disallowed.
- Administrators visit **Admin → Product comments** to approve pending comments, hide inappropriate content with a reason, and resolve reported approved comments. Actions are audited.
- If a product is archived/unpublished, its conversations are not publicly readable; moderation data remains private for continuity.
- The interface uses the existing style system, accessible buttons, text input labels and response messages. User-supplied content is escaped, never inserted as HTML.

## Feature flag and rollout

PRODUCT_COMMENTS_ENABLED defaults to **true** in local/test/staging and **false** in production. Its public bootstrap flag controls whether the component appears. Production enablement is a separate reviewed rollout, not an implied effect of merging.

Staging URL: https://staging.veelad.com/en/products/<real-published-product-id> or its /ar/ equivalent. Do not guess or publish sample IDs.

Backend API routes under /api.php?route=:

| Route | Verb | Access | Purpose |
|---|---|---|---|
| product-comments&product_id=...&page=0 | GET | public | Up to 15 approved roots with approved replies, total, next-page flag, and viewer-owned markers |
| product-comment | POST | signed-in | Create a pending comment or reply (product_id, body, optional parent_id) |
| product-comment-report | POST | signed-in | Report an approved comment (id,reason) using a fixed category |
| product-comment-delete | POST | owner or admin | Soft-delete by ID and clear body |
| admin-product-comments | GET | administrator | Pending/flagged moderation queue, maximum 100 per request |
| admin-product-comment | POST | administrator | Approve or hide; hidden content requires written reason |

All mutations use the existing same-origin session, CSRF verification, and server-side rate limits. Body text is limited to 1200 UTF-8 **bytes**; no HTML is supported. SQL uses bound values; approved public response does not contain email, contact information or internal moderation notes.

Migration 016-product-comments.json adds product_comments and product_comment_reports. Both are included in src/backup-tables.js for encrypted backup and recovery. **Never replace the original migration after it has been applied.** Review backups and restore compatibility in CI before rollout.

## Acceptance checklist

1. Product page works as a guest in English and Arabic; only approved comments are shown.
2. Buyer submits a comment. It is stored as pending and remains hidden from guests until admin approval.
3. Admin approves; a fresh guest session can see it. Artist replies (pending until approved) display with accurate attribution.
4. Unrelated or nested reply IDs, hidden parent comments, invalid product IDs and disabled products cannot be used to publish.
5. One account cannot delete or report another account's data except through the intended authorized operations.
6. Users can submit a report; the admin can hide with an explanation or approve/dismiss it. The public UI does not surface reports.
7. Paging, text escaping, fast re-navigation, keyboard focus and mobile layout work without console errors.
8. Neither checkout/payment activation nor production deployment is part of this work.

## Deferred features

Helpful comment votes, verified-purchase ratings, automatic email replies/notifications, photo uploads, sentiment ranking and artist notification digests are outside this version. Add them only after moderation capacity and real customer interactions justify them. Never fabricate ratings, purchases, testimonials or scarcity.

## Testing and release

npm run check validates JS syntax; npm test runs API and migration integration suites; npm run test:ui covers browser workflows. New contract tests live at tests/product-comments.test.js. CI must pass on the feature PR before it is merged to main, and the actual staging revision must be verified by /api.php?route=health. Local tests alone do not prove Hostinger deployed it.
