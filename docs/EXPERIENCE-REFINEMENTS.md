# Storefront and production refinements — 21 October 2026

This release improves the existing workflows. It does not turn on real payments, change product prices, certify supplier templates, or release production.

## 1. Guided customer designer

The signed-in designer has four persistent navigation steps: **Item → Your artwork → Edit → Review**. All sections remain accessible on the page. A sticky action bar shows the selected product category and its actual price, moves to the next step, and uses the existing validated add-to-bag action at review. It cannot bypass artwork rights, preview acknowledgement, product availability or server validation.

On phones the preview stays compact and visible while the editing controls scroll. Shorter phone viewports use a compact two-column preview so controls stay reachable; **Expand preview** opens a larger, unpinned inspection view without changing the design. Undo, redo, zoom and precision controls sit with the customer controls so they cannot make the pinned preview taller than the screen. The shared artist editor retains its existing layout. Artwork, independent product placements, text layers, starter layouts, autosave, draft conflict protection and language switching use the existing studio.

The navigation uses real buttons, visible focus and `aria-current="step"`. Reduced-motion preferences are respected. Choosing a step does not confirm a preview or submit an order.

## 2. Homepage entry points

Three visible starting points lead to the actual shop, artist directory and private customer designer. They appear alongside the existing product photography, campaign illustration and editorial sections. Copy is provided in English and natural Saudi Arabic.

Four curated edits give the page more structure without inventing products, reviews, sales figures or availability. Sample prices remain identified on the listings that actually have sample pricing.

## 3. Product galleries

Purpose buttons separate the **Product view**, **Artwork view**, **Detail view** and **Additional photos**, when those views exist. They navigate the same saved images used by the thumbnail gallery. Late-loading angles, keyboard navigation, zoom, swipe, error handling and bag selections remain supported.

The existing lifestyle editorial scene remains visibly identified as an AI-generated illustration. A close-up enlarges an existing bounded preview; it is not new native print detail. Mockups and opposite-side views remain provisional, and an unprinted opposite side is never presented as a second printed design. Private print originals are still available only through the protected administrator downloads.

## 4. Administrator print preparation

**Administrator → Production → Open production order** now includes an item-by-item readiness summary: original attachment or text-only source, latest proof status, payment status and preparation checklist progress.

**Print job sheet** opens an order-specific sheet. **Print or save as PDF** uses the browser print dialog. The sheet includes order and line references, item and variant, quantity, saved placement, authored text, artwork references and checklist states. It is generated from the saved order snapshot, including distinct lines containing the same product. It does not substitute today's catalogue artwork or placement for the ordered design.

**Download job manifest (.json)** exports the same preparation information in the versioned `veelad.print-job.v1` format. Both exports omit customer contact details, delivery address, guest tracking tokens, session data, and order-level internal notes. Authored artwork text can contain a name because that is part of the customer's requested design. Treat the downloaded production files as private.

An attached file is labelled **attached**, not verified. Download the protected original or composed print artwork and check it before printing. Job sheets and manifests are preparation documents, not supplier-certified manufacturing files. Their creation does not approve proofs, confirm payment or advance production.

## 5. Editable bilingual collections

The default collection definitions live in `data/curated-collections.json`:

| Collection | Arabic title | Customer destination |
| --- | --- | --- |
| Gifts with your name | هدايا باسمك | Enabled products in the private designer |
| A desk that feels like you | لمكتبك | Curated published shop products |
| A little colour, a lot of joy | ألوان وبهجة | Curated published shop products |
| Everyday favourites | قطع ترافق يومك | Curated published shop products |

Defaults use existing catalogue records, interleaving categories so one product type cannot fill an entire edit. They do not create products or change their commercial fields. A collection with no eligible products is omitted. Personalization collections only offer products explicitly enabled for customer customization; sold-out items have no design action.

Use **Administrator → Collections** to change the English and Arabic titles/descriptions, selected products, cover product, visual colour, publication setting, customization mode and collection order. Save all changes together. Language switching retains unsaved edits and their collection identities. A revision check rejects stale writes from another tab; reload before reconciling a conflict. Product and cover references are validated on the server. Covers use the selected product's existing image, or an illustrative blank template for personalization collections; no arbitrary remote image URL is accepted.

Collection links use `/en/shop?collection=desk-edit` and the equivalent Arabic URL. Category and sort filters stay within the selected collection. Retired/unknown collections show a helpful empty page. Existing staging and filtered-shop `noindex` rules remain in force.

### Database and rollback

There is no schema migration. Administrator saves add `curated_collections` and `collections_revision` to the existing `settings` row with ID `store`; settings backups already include these fields. Until the first save, defaults are projected without writing the database. Saves are transactional, audited, administrator-only and protected by CSRF and revision checks. Store-settings saves lock and merge the same row to preserve collection edits.

To roll back, redeploy the preceding tested staging release. Keep the settings data, order snapshots, original artwork and customer designs. Older application code ignores the new collection fields. No deletion, inventory rewrite, secret rotation or environment-variable change is required for this release.

## 6. Launch rehearsal and remaining checks

The automated phone rehearsal creates disposable local databases and fictional accounts and uses the real application routes. It verifies:

1. Native registration and explicit email-token confirmation.
2. A private high-resolution original, product placement and review acknowledgement.
3. Bag and address entry, order creation and the awaiting-payment state.
4. Administrator download of the exact original bytes.
5. Contact-free job-manifest export and a real A4 PDF generated from the print layout.
6. Administrator proof upload, customer approval and customer-visible production notes.
7. Refusal to start printing while payment remains unconfirmed.

The two phone layouts are iPhone 13 in English and Pixel 7 in Arabic, using Chromium device emulation. They are not physical iPhone/Safari or Android hardware tests. The fixture has no email delivery worker and no real payment service; verification messages are inspected in the local mail queue, and no actual email is sent. The existing verification/recovery browser tests separately cover both languages and both desktop/mobile projects. Their logout step waits for logout to finish before navigating to recovery, eliminating the race seen in the previous GitHub run.

### Validation commands

```sh
npm run check
npm run build
npm test
CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
```

Backend and browser tests use local/disposable databases, not staging/production data. The new tests cover collection authorization, invalid references, stale saves, unchanged unrelated settings, hidden products, bilingual editing, navigation and filters, private print-manifest contents, distinct order lines, and the phone rehearsal.

### After staging deployment

- Confirm `/api.php?route=health` reports the deployed SHA and `environment=staging`.
- Open English and Arabic homepages, each collection and the seven-category designer; check actual image loading and narrow-screen layout.
- Confirm the collection editor saves under an administrator account, and export a fictional order's job sheet.
- Check the real mailbox verification/recovery links on an authorized test inbox. Local queue tests do not prove hosted SMTP delivery.
- Check the designer and print dialog on a physical iPhone in Safari and an Android phone.
- Before real fulfilment, review supplier dimensions, printable areas, bleed, colour expectations, physical samples, pricing, shipping and returns. Existing provisional samples do not establish these facts.
- Production deployment and enabling real payment remain separate deliberate steps.
