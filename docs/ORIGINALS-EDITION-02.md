# Veelad Originals — Edition 02 (Priority 3)

This is a staging-first, owner-directed concept release with **48 named original vector concepts in eight six-piece collections**, created for Veelad. These are original compositions implemented in code, with six visual editions per creative direction; they are **not 48 separately commissioned hand-drawn illustrations**, nor are they stock photos, real garments, or certified print samples.

## Customer-visible access

- Public editorial gallery: `/en/creative/originals` (and matching language-aware routes).
- The gallery has eight collection filters, translated design titles, and a deep link for each item into `/en/create?drop=originals-...`.
- Opening a deep link **never adds a layer or overwrites an existing saved design**. Customers must click the explicit design card in Studio.
- Inside Design Studio, select **Layouts** → **Veelad Originals · Edition 02**. Search and filter among 48 designs.
- Inserting an original creates a private 1800 × 1800 transparent PNG artwork layer **plus an independently editable text layer**. Customers can drag, resize, rotate, recolour three channels, change the slogan, save drafts, and edit on product previews.
- The original vector SVG generator is first-party and deterministic. No external image URLs, remote fonts, brands, characters, or copyrighted third-party graphic assets are included.

## Collections

| Collection | Direction | Number |
| --- | --- | ---: |
| Streetwear Signals | Fashion and bold urban graphics | 6 |
| The Green Edit | Nature and botanicals | 6 |
| Future Frequencies | Technology and science motifs | 6 |
| City Lines | **Imaginary** urban silhouettes, not representations of specific landmarks | 6 |
| Modern Heritage | Original geometric craft inspired by regional architectural patterns | 6 |
| Say Something | Editable typography and graphic lettering frames | 6 |
| Space Notes | Fictional celestial and orbital compositions | 6 |
| Form & Feeling | Modern abstract geometry | 6 |

## What this release does NOT do

- It does **not** create, publish or price any shop product listing. A product requires the owner's authenticated upload and review, validated ownership and artwork provenance, confirmed supplier templates, print test, and actual product sizes and costs.
- It does not enable checkout, payments, real-order processing or shipping. No false live sales, stock, royalties or unverified artist names are created.
- The designs are available as first-party **concepts**, not supplier-certified print files. Check print resolution after customer placement and separately obtain final bleed, colour profile, safe areas and physical samples from the fulfilment partner.
- It does not alter the twelve earlier sample products or their encrypted originals, publisher journal, artwork records, production orders, user accounts, or production database.

## Validation

Run `npm run check && npm run build && npm test`, then desktop/mobile browser tests including `tests/browser/original-drops.spec.js`. The new Node regression tests rasterize all 48 source SVGs, check transparency and unique IDs, validate safe colour markup, three-language labels, and stored layer IDs. A browser rehearsal checks the end-to-end editable design path and persistence.

Deploy to **staging** only. Confirm `/api.php?route=health` returns the expected merge commit and that `/assets/veelad-original-drops.js?v=1` is served. Production requires a separate, explicit approved release. Rollback the staging branch to the previous verified SHA; previously saved private customer drafts should remain intact, but editing newly referenced graphic IDs requires restoring the corresponding artwork module. Back up the staging database and uploads before any restoration.
