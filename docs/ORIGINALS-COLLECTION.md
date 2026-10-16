# Veelad Originals — First Edit

## Scalable editions — 16 October 2026

The owner approved newly drawn scalable editions of all six themes. These are new vector compositions, not enlargements or recovered detail from the earlier raster images. Portrait PNG originals are rendered directly from their SVG sources at **4560 × 6840 pixels**; square originals are **6000 × 6000 pixels**. The SVGs contain original geometry, without embedded raster pictures, font dependencies or external resources. The PNG remains compatible with the existing private artwork and placement workflow.

The new editions are packaged separately in `veelad-scalable-01.json` and authenticated encrypted bundles. The original collection manifest, ciphertext, upload records, bytes and historical order snapshots remain unchanged. Installation requires the exact staging environment/origin, the approved existing account, and each complete unedited original sample record, including its private notes and placement. Edited, archived, reassigned, deleted or commercially changed listings are skipped. Only matching future listings receive the new source, correctly regenerated mockup, provenance and matching bilingual description/story. Sample prices and simulated stock remain explicitly labeled.

An immutable completion journal in backed-up settings prevents replaying the upgrade over later edits. Each changed product has its own before/after journal. Each SVG master is compressed into its own private settings record below the existing SQL TEXT limit; encrypted database backups therefore retain the actual editable vector source along with PNG files. No plaintext master or secret enters the public repository. Existing source rows can recover their exact missing PNG from the authenticated new bundle; conflicting files are never overwritten.

Administrators open **Products → Design files** to download the native PNG or **Download scalable master (.svg)**. SVG downloads require administrator authorization, are audited, and use attachment/octet-stream with a sandbox policy. They are never served as inline artwork or public previews. The same dialog shows byte-derived native dimensions and a 300 DPI size estimate. Larger native dimensions and scalable geometry do not confirm supplier dimensions, bleed, colour handling or a physical sample. Phone/notebook dimensions remain provisional. Real payments remain disabled.

For data rollback, compare the current product to the per-product journal's after-state before restoring its before-state, preserving subsequent administrator changes. Do not delete either edition's source rows/files or remove SVG master settings while any order may reference them. A code rollback alone does not undo data edits. Preserve the new administrator source-download implementation for fulfilling orders that use the scalable edition.

This staging-only collection was requested by the store owner on 16 October 2026. It contains twelve new product concepts using six original AI-assisted artworks, with separate English and Arabic names, descriptions, design stories and search tags.

| Artwork | Arabic name | Products |
| --- | --- | --- |
| Desert Afterglow | وهج الصحراء | T-shirt, art print |
| Wild Bloom | زهور برّية | Notebook, tote bag |
| Midnight Orbit | مدار الليل | Mug, sticker |
| Red Sea Drift | سكون البحر | T-shirt, phone case |
| Slow Sunday | على رواق | Mug, tote bag |
| Courtyard Rhythm | إيقاع الفناء | Art print, notebook |

The Redbubble reference informed the gallery, design-family links, artist sections and product discovery. Its artwork, characters, photographs, seller identity, product specifications and policies were not imported.

## Installation and review

After staging migrations, the runtime reads `data/collections/veelad-originals-01.json` and matches its approved email fingerprint against an existing active account. It never creates an account, resets a password, changes a role or claims an unverified email. A missing or suspended account leaves installation pending and is checked again on the normal operations interval. Production and local startup do not install this collection.

The twelve listings are first created **pending review**, with price and availability unset (`0`). The owner then explicitly approved showing the collection publicly **on staging with sample prices**. A separate, one-time staging publisher checks the exact unedited initial records, account ownership, original files and review state, then publishes eligible entries with `sample_pricing: true` and `stock_is_simulated: true`. It leaves edited, deleted, reassigned or already reviewed records alone. Its completion journal is also included in existing backups. No automatic artist update emails are sent by installation or sample publication.

In **Administrator → Products**, the collection banner links to all twelve records. Each has a full-page **Preview**, editable bilingual listing details, and private original-file controls. Public cards, product pages and the mobile purchase bar identify sample prices. Product pages say **Sample listing**, without implying confirmed physical stock. The twenty-five virtual units per listing are for testing staging carts only.

| Category | Illustrative price (SAR) |
| --- | ---: |
| T-shirts | 99 |
| Mugs | 49 |
| Tote bags | 69 |
| Notebooks | 39 |
| Art prints | 59 |
| Phone cases | 59 |
| Stickers | 12 |

These are test prices, not supplier quotations or commitments. Real payment collection remains disabled. Review actual pricing, variants, availability and production specifications before any production release. Production startup never installs or publishes this collection.

The installer has deterministic product identifiers, an advisory lock and an atomic database transaction. A completion marker in backed-up settings prevents repeat deployments and restored snapshots from creating duplicates or replacing administrator edits. Its operational-status copy is available through the authenticated system endpoint. A new staging process can recover a missing original from this collection's encrypted bundle after checking its existing product and upload ownership. It never replaces a changed file, recreates a deleted listing or repairs unrelated artwork. Original files are fully written and synced in private temporary files, then published atomically without overwriting an existing destination. Staging health exposes only a coarse setup status, without account identifiers or product counts.

## Original files and previews

The repository is public. Original PNG files are therefore bundled as authenticated AES-256-GCM ciphertext under `data/collections/artwork/`, outside the web root. A separate key is derived for this bundle from the already configured staging environment secret using HKDF, per-file random salts and collection-specific context. No key or original PNG is committed. The existing staging secret was checked privately before packaging.

Staging verifies the envelope, authenticated filename, plaintext checksum, actual image format and size before writing originals into the existing private artwork directory. The runtime applies each exact artwork to the existing category-specific mockup renderer; product previews are derivatives. Public image requests return bounded WebP previews. Original downloads continue to require the existing owner or administrator authorization. Staging health can report a sanitized installer error code, cause enum and stage to diagnose hosting failures without exposing environment values, account details or filesystem paths; store readiness remains independent.

Retain a private backup of the originals and the appropriate recovery keys. If the staging environment secret is rotated before installing this bundle, repackage the ciphertext privately with the new secret. Do not put old or new secrets into GitHub. An unreadable bundle does not take down store readiness and does not partially publish products. Existing encrypted backup/restore remains the recovery path for deployed data and original files.

Original files retain their native dimensions, generally about 1,024–1,312 px wide and 1,199–1,536 px high. They were not enlarged and described as higher-resolution originals. This supports detailed visual concepts, not a certification for large-format printing. Administrator production notes record the actual dimensions and 300 DPI guidance. Final print sizes may require a higher-resolution original, supplier template and physical sample. Materials, phone models, paper specifications, washing instructions and delivery claims remain unconfirmed.

## Lifestyle images

`public/assets/lifestyle/everyday-people.webp` and `creative-studio.webp` are original AI-generated campaign illustrations. Their visible captions identify them as illustrations. They do not depict actual customers, artists, a verified factory, confirmed garment fit or the finished products. WebP derivatives are sized for the site; full generated masters remain outside the public repository.

## Rollback

Application rollback can redeploy the preceding staging revision. The twelve data records and their private files are additive and remain available for review; an application rollback does not delete them. To hide an already approved sample, archive it through the administrator dashboard. Keep order history and artwork records rather than deleting referenced products. Restore database and artwork together from an appropriate encrypted backup when a data rollback is required. Production promotion remains a separate action.
