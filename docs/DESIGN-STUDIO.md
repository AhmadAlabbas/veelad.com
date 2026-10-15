# Product design studio

Artists upload an original, preview it on seven generic products, adjust each placement, and save a private draft or submit for administrator review. The English and Arabic studio share the same original, product ID and placement data. Artwork is never mirrored in RTL. Upload replacements are atomic: an invalid/failed replacement keeps the previous accepted original and saved placements. Actual upload progress is shown; accepted uploads still need production review.

## Visual previews and limitations

The seven product families are T-shirts, tote bags, mugs, notebooks, phone cases, art prints and stickers. Templates are **provisional**: no supplier templates have been supplied. The current white generic product bases are AI-generated photographic-style illustrations, with manually calibrated surface meshes for deterministic artwork placement. They are not photographs of a supplier's actual goods. The initial Blender-based prototype has been superseded. The interface and exported PNG label them as visual previews, not print files or physical samples.

Each product retains independent position, scale, rotation, repetition, print-area background and view. T-shirts support front/back placement views; mugs support opposite views of the same wrap. This version has one design/placement per product family, not separate artworks for two garment sides. Phone camera cutouts are generic and are not device-specific fit guarantees. Stickers use a generic rounded-square surface, not an automatic die-cut contour. Material color is the generic template color; background controls affect the printable area only.

Drag on the product's printable surface to reposition; keyboard arrows adjust by 1% (Shift: 5%). Numeric controls allow exact logical placement. The dashed guides show the provisional printable boundary and a 5% inset. No supplier bleed, spot colors, color matching, CMYK conversion, device-specific manufacturing file, or production-ready PDF is generated. Original bytes remain unchanged.

DPI estimates use the **oriented original image pixel dimensions** divided by the placed physical size inferred from the provisional 300-DPI canvas. They do not trust embedded DPI metadata. Below 150 DPI is flagged low, 150–299 requires review, and 300+ indicates a good resolution estimate only. Cropping and excessive pattern density are flagged separately. Notebook/phone templates have no confirmed physical canvas and always require a supplier template, with no numeric DPI claim. Transparent margins in an original still count toward its dimensions; the artist and administrator must inspect usable artwork, not just this estimate.

Selecting a preview also selects the preferred listing category when the listing-mockup option is checked. Requested product checkboxes are review requests for this same design, not automatic creation of seven sellable SKUs. The administrator still controls category, price, stock, specifications and approval.

## Saved data and private files

`products.data.design_studio` contains version `1`, `template_version`, `artwork_id`, `active_product`, and per-product `placements`: normalized `x/y` (0–1), `scale` (0.1–2), `rotation` (−180–180), `repeat` boolean, `background` (`transparent` or 6-digit hex), and an allowed `view`. `listing_mockup` preserves the artist’s presentation-image preference. The server validates bounds and binds these settings to the exact original ID. No migration is required; these are additive JSON fields. Earlier listings without studio data remain editable.

On save, an authenticated artist/admin may request `POST design-mockup` with `{id?,upload_id,category,design_studio}` and CSRF. Source ownership or assignment is checked before reading the private file. The server independently renders a bounded 1000×1000 JPEG from the source's bounded lossless render preview and validated placements. It returns `{mockup_upload_id,source_upload_id}`. The derivative ID hashes the source, template version, category and placement, allowing safe reuse on repeated saves. Browser-generated preview bytes are never accepted as a trusted storefront mockup. Access is private until approval, following existing image authorization rules. An artist edit returns the listing to pending review.

`mockup_upload_id` is the storefront presentation image. `upload_id` remains the exact original for printing; order snapshots retain both IDs and the placement settings at purchase. These snapshots are visible only through the existing private order access rules. Product gallery photos remain separate. Unchecking the listing-mockup option clears the presentation derivative on save. Existing cached derivatives can remain in private storage and backups; do not delete upload records/files without checking current products, portfolios and historical orders.

Administrators open **Products → Design files** to download original(s) and **Download placement plan (.json)**. The plan includes source ID, original dimensions, requested product placements, quality estimates and explicit `supplier_confirmed:false`. It is a handoff aid, not a print-ready file. The original/ZIP download contains original attachments, not the generated mockup. Manage order also offers the placement plan captured at purchase (`admin-design-plan&id=PRODUCT_ID&order=ORDER_ID`); editing a listing later cannot change those order instructions. Orders placed before this feature have no placement snapshot. Private placement data is omitted from public bootstrap; administrator plan downloads are audited. Customers and artists cannot download the originals using the administrator endpoint.

## Supplier templates and assets

`public/assets/print-products.json` is the canonical provisional product configuration shared by client and server. Its preview aspect ratios correspond to the surface meshes in `public/assets/mockups/*.json`. Canvas pixels are provisional estimates; `null` explicitly means unknown physical dimensions. Before adding a real supplier, confirm printable dimensions, safe areas/bleed, device cutouts, product colors, print method, accepted source formats, ICC handling and a physical sample. Update geometry, projections and dimensions together, version the configuration, and adapt saved layouts explicitly; changing numbers alone does not create a matching supplier mockup.

The historical procedural prototype used this optional development tool (Blender 4.3; not a server dependency). This command does not reproduce the current photographic-style bases; use the photographic preparation command below:

```sh
VEELAD_RENDER_ENGINE=BLENDER_EEVEE_NEXT blender --background --threads 8 --python tools/render-mockups.py -- --output /tmp/veelad-mockups
```

Use Sharp to convert the PNGs to quality-90 WebP, and copy the paired projection JSON files into `public/assets/mockups/`. Review every view with asymmetric test artwork before publishing. Runtime rendering uses existing Sharp and browser Canvas. It does not generate images with an AI service, contact an external image provider, or require a new npm runtime dependency.

## Release and rollback

Run `npm run check`, `npm run build`, `npm test` and `npm run test:ui` with the documented local database. Browser tests cover both viewports, independent placements, language preservation, invalid replacements, preview export and reopening. Integration tests cover source/derivative ownership, private draft previews, publication, admin placement plans, caching and byte-exact original downloads.

Deploy development changes to staging. Production remains a separate deliberate release. Back up the database and private upload directory together before production. Reverting to the preceding private-artwork version preserves source files and additive JSON data, but its storefront will show the original preview rather than the new mockup. Never revert to a version that publicly serves full originals. Forward-fix mockup rendering failures; original printing files remain independent of disposable visual derivatives. Payment and email delivery settings are unchanged.

## Photographic presentation upgrade (2026-10-15)

The current base set is `render_version: veelad-photo-1`: AI-generated photographic-style blank products with cloth weave, stitching, folds, ceramic highlights, paper/case texture and lavender studio backgrounds. These are generic product illustrations, not photographs of verified stock or a selected supplier. Seller artwork is **never regenerated or sent to an image model**. The built-in image tool was used only to prepare blank bases during development; it is not called by the website and adds no runtime image-service dependency.

The browser and server now use the same bounded pixel surface projector with premultiplied-alpha bilinear sampling. Each pixel is sampled once, preserving translucent designs without overlapping triangle seams or darkened opacity. Cloth surface offsets derive from the photographed-style base luminance; mugs use a calibrated cylindrical wrap; phone camera openings and rounded sticker corners use explicit masks. Shadows/material detail come from compositing the unchanged artwork against the base. This improves appearance without certifying physical print accuracy. Server compositing uses an oriented, metadata-stripped, lossless PNG source capped at 1600 px, avoiding an additional lossy artwork encoding before rendering; web previews are WebP at quality 90, still bounded and separate from byte-exact originals.

Completed mockups use the full image area in storefront cards, galleries, thumbnails and order summaries. Raw artwork previews retain their separate inset treatment. `render_version` versions disposable visual derivatives independently of logical `template_version`, so existing placement coordinates and order snapshots remain valid. Authorized preview requests lazily build the upgraded derivative for old mockup IDs. The listing pointer, original, old derivative and saved order instructions are not rewritten. Unauthenticated requests cannot rebuild/view private drafts. Missing source/storage availability falls back to the existing preview where available; existing missing-file warnings still require restoration of the original.

Current preparation command:

```sh
node tools/prepare-photo-mockups.js /private/path/photo-sources.json
```

The source mapping is `{ "shirt": "/path/to/generated.png", ... }` for all nine view names. The original PNG masters are session artifacts; the committed WebP/projection pairs are the deployable source of truth. See `public/assets/mockups/README.md`. The Blender command above documents the historical prototype only, not the current photographic bases. No real payments or production branch changes are part of this staging update.
