# Design pilot: inspection and proposal

Inspection date: 15 October 2026. **Step 0 only: no images generated, no model downloaded, no designs imported and no paid generation authorized.** The favicon correction is a separate interface change.

## What exists today

The checked-out Node.js application, migration files and public staging API were inspected. There is no authenticated staging database or administrator session available in this workspace, so private dashboard counts and deployed table contents were not inspected directly. Public staging currently returns **12 published products and six artist profiles**. That does not establish how many private drafts or uploaded originals exist, or contradict an empty studio for a particular artist. The dashboard's Products tab is scoped to its account role and filters.

| Item | Current implementation |
| --- | --- |
| Products | `products(id, artist_id, status, stock, data, created_at)`. `data` is JSON in TEXT; `stock`, ownership and publication status are separate columns. Money is integer SAR halalas: `9900` means SAR 99. |
| Designs | No separate design/master table. A product references one private original with `upload_id`; the same upload can be referenced by multiple permitted product records. Requested `print_formats` do **not** automatically create sellable products. |
| Categories | Seven fixed English keys in `src/app.js`: `T-shirts`, `Tote bags`, `Phone cases`, `Art prints`, `Mugs`, `Stickers`, `Notebooks`. Arabic UI labels translate these keys. No category table. |
| Variants | A product JSON `variants` array: 1–12 unique strings, at most 50 characters each. No separate SKU, per-option inventory, per-option price, size template or printer variant identifier. Stock and price belong to the whole product. `variants_ar` is not accepted/persisted by the current product validator. |
| Artists | `artists(id, data)` stores profile JSON; a real artist account also has a `users` row. Artist ownership must be chosen explicitly; sample profiles are not permission to attribute new work to them. |
| Reviews | `product_reviews(id, data)` records pending review, feedback and review timestamps. Artist drafts/submissions start with zero price and stock; administrators set commercial details. |
| Upload records | `uploads(id, user_id, path, mime)`. An opaque local filename references the original; it is not an external image URL. |
| Storage | Local private filesystem under the runtime's `UPLOAD_DIR`, default `var/uploads`, not S3/Cloudinary. The previously supplied Hostinger path was `/home/u260732541/private-artwork/`; the currently deployed environment value cannot be confirmed from public responses. Original files use mode `0600`. |
| Limits | PNG/JPEG only, up to **25 MiB**, **60 megapixels**, minimum **100 × 100 pixels**, non-animated, decoded before acceptance. SVG/PDF are rejected. These acceptance limits do not certify print quality. Gallery browser inputs impose a separate 8 MB client limit. |
| Originals/previews | Original retained byte for byte. Authorized image endpoint returns a metadata-stripped WebP preview, at most 1600 px per side. Only an administrator can download the original for printing. Private draft previews require permission. |
| Print provider | **None integrated.** No Printful, Printify, Gelato, provider templates, print-area mapping, automatic fulfillment or provider-generated mockups found. Staff printing/shipping is manual. There are no verified provider image specifications to report. |
| Mockups | Artist upload form has approximate CSS mug/T-shirt placement previews, explicitly not production proofs. There is no photo-template mockup renderer or automatic storefront mockup generation. Optional gallery upload IDs can hold approved product photos/mockups, but there is no separate mockup metadata model. |
| Customer custom designs | **Not implemented.** Upload API permits artist/admin accounts only. Registering as a buyer does not grant artwork upload. |

Staging health reports two missing original files and a failed backup. Files surviving earlier deployments is not a contractual durability guarantee. Resolve missing originals and establish a successful recoverable backup before relying on imported files as the production archive.

Source references: `migrations/001-schema.json`, `migrations/003-artist-operations.json`, `src/app.js`, `src/artwork.js`, `src/artists.js`, `src/config.js`, `public/assets/artist-tools.js`, `public/assets/design-preview.js`, `docs/DESIGN-PRODUCTION.md`.

## Current creation and import routes

- Artist: `/en/studio?tab=upload` or `/ar/studio?tab=upload`, upload artwork, fill bilingual fields, then **Save draft** or **Submit for review**. Drafts are visible to their owner and administrators, not customers.
- Administrator: Products → Add/Edit product. The API supports `active`, `pending`, `changes_requested`, `archived`, **not `draft`**. An administrator cannot directly approve an artist's unsubmitted draft. The artist must submit it first.
- `POST /api.php?route=upload`: authenticated artist/admin, multipart field **`artwork`**, with the current session CSRF header `X-CSRF-Token`. Returns `{upload_id, artwork}`.
- `POST /api.php?route=artist-product`: authenticated artist JSON request. `action: "draft"` creates a true private draft; `action: "submit"` requires an original, English title/description and `rights: true`. Returns `{id, status}`. Ownership is the signed-in artist; `artist_id` cannot be used to impersonate another owner.
- `POST /api.php?route=admin-product`: authenticated admin JSON request, explicit valid `artist_id`, permitted review/publication status and commercial details.
- Existing `scripts/provision.js --demo` is **local/test only**, not a staging import tool. `scripts/audit-import.js` is a read-only integrity checker, not an importer. No product CSV importer or bulk-design importer exists. Order CSV **export** is unrelated.
- Uploads are throttled to **25 requests per IP per 15-minute bucket**; the proposed importer must pace requests and checkpoint on 429 instead of bypassing the limit.

## Exact fields and example

The current artist draft request can be as small as a title/category/action; for a useful pilot, use the following complete metadata and attach the uploaded production file. English keys remain stable in both UI languages.

```json
{
  "action": "draft",
  "title": "Desert sunrise",
  "title_ar": "شروق الصحراء",
  "description": "A geometric desert sunrise design for everyday objects.",
  "description_ar": "تصميم هندسي لشروق الشمس فوق الصحراء يرافق تفاصيل الحياة اليومية.",
  "category": "T-shirts",
  "print_formats": ["T-shirts", "Tote bags"],
  "tags": ["desert", "sunrise", "geometric"],
  "tags_ar": ["صحراء", "شروق", "هندسي"],
  "variants": ["Standard"],
  "upload_id": "UPLOAD_ID_RETURNED_BY_UPLOAD_API",
  "gallery_upload_ids": [],
  "production_notes": "Pilot design gulf-001; review the provider template before printing."
}
```

The example is a schema illustration, **not generated artwork or a live import**. On creation the server assigns `id` and the authenticated `artist_id`, saves `status: draft`, `price: 0`, `stock: 0`, `royalty_percent: 20`, `badge: New`, `sheet: 0`, `cell: 0` and `created_at`. The royalty value is a current application default, not a new business agreement. Later requests include the returned `id` to update the same record.

| Field | Exact current rule/use |
| --- | --- |
| `title`, `title_ar` | Up to 100 Unicode characters. English required for submission; Arabic optional. Empty drafts get `Untitled draft`. |
| `description`, `description_ar` | Up to 2000 characters. English required for submission, Arabic optional. |
| `tags`, `tags_ar` | Arrays of up to 12 nonempty strings, each up to 50 characters. Not comma-separated strings at the API boundary. |
| `category` | One exact category key above. Separate listings are needed to sell the same master on different categories with different prices. |
| `print_formats` | Optional array of supported category keys; requests for intended use, not variant/SKU creation. |
| `variants` | Nonempty array of up to 12 strings, default `Standard`; artist edits retain administrator-set options. |
| `upload_id` | Optional while drafting, required for artist submission. Existing valid upload ID with permitted ownership. No arbitrary URL or local path. |
| `gallery_upload_ids` | Optional array, at most six distinct valid permitted uploads; suitable for finished product photos/mockups after approval. |
| `production_notes` | Private, at most 2000 characters; excluded from public catalog and order snapshots. Not a durable substitute for the pipeline manifest. |
| `materials[_ar]`, `dimensions[_ar]` | Optional strings, at most 300 characters each. Actual provider/material details must be supplied later. |
| `care_instructions[_ar]` | Optional, at most 1000 characters. |
| `size_guide[_ar]` | Optional, at most 2000 characters. |
| `price` | Admin integer halalas, 0–100000 for unpublished records; publishing requires at least 100. Artist-supplied values cannot set initial retail pricing. |
| `stock` | Admin integer 0–100000, interpreted as available fulfillment capacity. Artist draft starts at zero. |
| `artist_id`, `status` | Required/selected for admin creation; artist identity/status are derived from session and action in the artist route. |
| Slug and image URLs | No slug field. URLs derive from generated product ID: `/en/products/ID`, `/ar/products/ID`. Web image URL derives from `upload_id`; high-resolution original remains private. |

## Proposed pilot, pending approval

**Ten master designs, twenty private draft listings:** two product exports per master, initially T-shirts and tote bags. Keep all seven category definitions in one proposed `design-pipeline/config/print-specs.json`, but defer phone-case and notebook exports until actual supplier/model templates exist. Expand product coverage only after the pilot's quality and cost are approved.

Suggested six niches and allocation:

| Niche | Consistent style | Masters |
| --- | --- | --- |
| Desert light | Geometric dunes, warm terracotta/sand/navy, bold silhouettes | 2 |
| Gulf coast | Flat waves, shells and coral-inspired shapes, teal/coral | 2 |
| Coffee and dates | Simple still lifes of cups, palms and dates, limited warm palette | 2 |
| Native botanical | Clean desert-flower/palm illustrations, olive/cream | 2 |
| Everyday optimism | High-contrast abstract shapes; optional separately typeset short bilingual copy | 1 |
| Quiet geometry | Minimal repeating geometric composition, no borrowed brand/pattern assets | 1 |

No model-rendered lettering, third-party logos, characters, celebrity likenesses or imitation of living artists. Arabic copy is added with the site's licensed font through Chromium shaping and reviewed by a fluent reader. Do not automatically translate proper names or invent product/material claims.

### One specification file

These are the user's **provisional targets**, not printer-approved specifications:

| Product | Canvas | Notes |
| --- | --- | --- |
| T-shirt | 4500 × 5400 | 300 DPI, transparent PNG |
| Tote bag | 4500 × 4500 | 300 DPI, transparent PNG |
| Sticker | 1800 × 1800 | Transparent PNG, clean edges; physical size/cutline needs printer confirmation |
| Mug wrap | 2700 × 1050 | 300 DPI; background/handle exclusion depends on template |
| Art print | 5400 × 7200 | 300 DPI, full bleed; add actual supplier bleed/trim after template selection |
| Phone case | Unset | Block export until model-specific cutouts, bleed and safe area are supplied |
| Notebook | Unset | Block export until provider trim, bleed, spine and cover template are supplied |

All PNG exports should be sRGB, with 5% provisional content inset and explicitly recorded DPI. Five percent is a starting rule, not a substitute for printer safe areas. Upscaling and a 300-DPI metadata tag do not recreate missing detail. Full bleed backgrounds must reach the edge while important foreground elements respect the safe area.

### Proposed files and tools

```text
design-pipeline/
  README.md
  config/print-specs.json
  input/prompts.csv
  src/generate.py
  src/prepare.py
  src/typeset.mjs
  src/export.py
  src/qa.py
  src/mockups.py
  src/import-staging.mjs
  templates/                 # only licensed templates we may redistribute
output/pilot/                # ignored/private; never committed by default
  masters/ prepared/ print/ mockups/ review/
  manifest.csv
  import-state.json
```

Use Python/Pillow for composition and PNG metadata, local Real-ESRGAN for suitable raster enlargement, optional rembg for background removal, and optional vtracer/potrace for simple flat artwork. Review tool/model licenses and quality for the exact installed version before use. Use existing Playwright/Chromium for Arabic shaping; self-hosted fonts include their OFL notices. Vector masters stay private workflow assets; the app still accepts PNG/JPEG only.

The runner reads the requested prompt CSV columns, produces one native-resolution master per ID, caches by model/version/prompt/seed/settings hash, and reuses that master for both initial product exports. Different seeds/compositions are new paid work and must not silently bypass the budget. Never destructively crop important artwork to force an aspect ratio: re-layout inside the safe area or send it to review. Separate pattern masters require approval before additional generation.

QA checks exact pixels, density metadata, color profile, alpha requirements, empty images, bounded foreground placement and a blur heuristic. Keep composition masks to check safe zones; arbitrary full-bleed images cannot have their semantic content judged reliably by a pixel-only rule. Blur checks flag review, not proof of print quality. Failures and their reasons go to `review/`; never delete the master. Phone/notebook missing templates fail before export.

Photo mockups require licensed template photos and placement masks supplied/approved by the owner; none were found in the current app. Do not imply a CSS preview is an actual photo of the finished merchandise. Storefront mockup previews are separate from exact production originals.

`manifest.csv` records design ID, niche, product, bilingual metadata, print path, dimensions, DPI, byte size, hash, QA status/reasons, prompt, model/version/seed, generation cost and currency, and returned upload/product IDs. Keep sensitive paths, source files and session secrets out of GitHub and the public web root.

### Staging import proposal

1. Dry run validates all metadata, local files, hashes and QA; prints planned creates/updates without uploads or database writes.
2. Real run requires an explicitly selected real **artist account**, an authenticated private session/CSRF token, and exact `staging.veelad.com` origin. Refuse production, unexpected redirects and alternate origins.
3. Upload approved product-specific originals through the existing upload API, then create artist products with `action: draft`. No seed script, SQL import, publication or payment changes.
4. Checkpoint each returned upload and product ID. Retry/update by saved ID rather than creating duplicates; respect upload throttling. Stop on ambiguous create responses for reconciliation rather than claiming exactly-once semantics: the current create API has no importer idempotency key. A future robust importer may need an additive staging-safe idempotency mapping to resolve interrupted creates.
5. Verify each imported record in the owner's studio and admin Products list and confirm it is absent from the public bootstrap response. Review appearance before submission. Shared originals remain private.

No importer is implemented yet: this report intentionally stops at the requested approval boundary.

## Three zero-credit generation candidates and cost estimate

The lowest **API-credit** approach is local generation. These are candidate open-weight models, not a verified ranking of current paid provider prices:

| Candidate | Why consider it | Budget implications |
| --- | --- | --- |
| [FLUX.1-schnell](https://huggingface.co/black-forest-labs/FLUX.1-schnell) locally | Few-step generation and strong simple compositions; published as an Apache-2.0 model | $0 API credits; comparatively high RAM/VRAM needs, possibly offload/quantization |
| [SDXL base 1.0](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0) locally | Broad tooling and strong illustration control; published with the OpenRAIL++ license | $0 API credits; slower/more steps and hardware-dependent runtime |
| [Stable Diffusion 1.5](https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5) locally | Smaller model, useful on less capable hardware for simple flat motifs; published with an OpenRAIL license | $0 API credits; lower native resolution and greater quality-review burden |

The model hosts could not be reached from this environment, including the retry with elevated network access. These license names describe the known base releases; **verify the exact weights, distribution and license before downloading**, including any adapter/upscaler/removal models. Do not substitute a restricted or noncommercial checkpoint. No GPU availability or runtime speed is assumed for this cloud environment or the owner's machine.

| Scale | Native generations | Proposed draft listings | Estimated API credits | Other costs |
| --- | --- | --- | --- | --- |
| Pilot | 10 masters, no automatic paid retries | 20 (two products per master) | **0** with local models | Existing hardware/electricity; any GPU rental is separate and unapproved |
| Later scale | 200 masters, only after approval | 400 for two products, up to 1400 if all seven become supported | **0** with local models | Compute/storage/time scale with volume; no rental or paid API estimate can be quoted accurately without a chosen provider/model/quality |

Existing-hardware electricity and optional GPU rental are not free, even when API credits are zero. If suitable hardware is unavailable, first present a paid provider quote and a hard total budget for approval. This session's image-generation tool does not expose a per-image price here, so do not invent a credit quote or launch billable generations. Default paid spend remains **$0** until an explicit budget is approved.

## Customer upload feature: separate later proposal

After the pilot, propose a dedicated custom-print-request flow rather than granting buyers the artist/admin upload endpoint. It would need private buyer-owned files, PNG/JPEG byte/pixel validation, template-specific resolution warnings, moderated request statuses, product/variant selection, protected original access, an approximate mockup, a rights/terms checkbox with a recorded policy version, and report/removal controls. Staff must approve artwork/template/quote before printing. Link the approved custom request to an order without making it a public artist listing. Define retention and deletion rules. Do not add this feature or enable real payments during the pilot.

## Approval requested

Approve or adjust: **10 masters across the six niches above; T-shirts and tote bags first; local generation with $0 paid spend; 20 private staging drafts; no publication.** Before execution, select the real artist account that should own the drafts, confirm a usable local GPU or an alternative approved compute budget, and provide/approve licensed product mockup templates. Provider-specific products remain blocked until their exact templates are available. Quality and cost approval is required again before scaling beyond ten masters.
