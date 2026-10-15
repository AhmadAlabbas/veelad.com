# Designs, printing and delivery

Artists submit original designs. Veelad reviews each design, chooses the finished product and commercial details, prints the approved design, and ships the finished product to the customer. Uploading a design does not publish a product or enable payments.

## Artist submissions and bilingual content

English title and description are required when submitting for review. Drafts can be incomplete. Arabic title, description, tags and product details are optional; missing Arabic content falls back to the English value. Artist profiles have optional Arabic name, biography, story and location. Administrators can maintain Arabic announcements, delivery estimates and return policies. Existing content is retained when older forms omit these optional fields; send an empty string or array to clear one.

Product tags accept up to 12 entries per language, with 1–50 Unicode characters per entry. Supported print formats are T-shirts, tote bags, phone cases, art prints, mugs, stickers and notebooks, using the existing English category keys internally. Print-format choices describe the artist's intended uses; the team must still confirm suitability for each product.

New artist drafts and submissions have price and stock set to zero. Artists cannot set or change these commercial values. Artist edits also retain administrator-set product options. Artist edits retain the existing administrator-set price and stock and return the listing to private review. Administrators can request changes while the price is zero. Publishing an active listing requires a valid retail price. Stock represents the quantity Veelad can currently fulfill, including print capacity; an active listing with zero stock remains unavailable for purchase.

`production_notes` are private to the artist's studio and administrator dashboard. Public catalog responses, page metadata and customer order snapshots must exclude them. Orders retain their English and Arabic item titles at purchase time.

## Private originals and web previews

Accepted files are PNG and JPEG, up to **25 MiB** and **60 megapixels**, with at least 100 pixels per side. Files are decoded before acceptance. SVG, PDF, animated files and other formats are rejected. These limits are acceptance boundaries, not a guarantee that a design is suitable for printing. PNG is recommended when transparency is needed; JPEG does not preserve transparency.

The submitted original is stored byte for byte in the private `UPLOAD_DIR`, using an opaque ID and permissions `0600`. The upload directory must remain outside any web-accessible directory and be backed up as documented in [OPERATIONS.md](OPERATIONS.md). Original filenames and server paths are not exposed to customers. Existing original records and administrator recovery remain compatible.

`GET /api.php?route=image&id=UPLOAD_ID` returns an oriented WebP preview of at most 1600 pixels per side, without embedded metadata. Preview access follows the existing private/public listing and portfolio rules. Published previews are viewable by customers; high-resolution originals are not served by this route.

`GET /api.php?route=artwork-metadata&id=UPLOAD_ID` requires an artist or administrator session. Artists can inspect their own or assigned listing artwork. It returns `{artwork: {upload_id, width, height, size_bytes, format, print_width_cm_300dpi, print_height_cm_300dpi, resolution_guidance}}`. The 300 DPI dimensions are calculated from pixel dimensions; they do not attest to the file's DPI, image quality, print readiness or a particular supplier's requirements. Veelad must verify the exact print template, bleed, usable image area and color handling before printing.

`GET /api.php?route=admin-artwork-original&id=UPLOAD_ID` requires an administrator session, downloads the exact original as an attachment, and records an audit entry. Sellers and customers cannot use this endpoint. Downloaded originals must remain within the team's private production workflow.

## Fulfillment and language preference

The existing order state transitions remain intact: unpaid orders await payment; confirmed test orders enter `processing`, then `shipped`, then `delivered`. The bilingual dashboard may label `processing` as printing/production. This release does not activate real payments, SMTP, or a new payment-dependent transition.

`POST /api.php?route=language-preference` with `{locale: "en"}` or `{locale: "ar"}` requires an authenticated session and the existing CSRF header. It stores the user's preference in the existing JSON customer state; bootstrap returns `locale`. Cart, saved products and address data remain intact. No database schema migration is required for these additive JSON fields.

## Verification and rollback

Backend checks cover Arabic field persistence, omitted-field compatibility, per-user preference persistence, protected price/stock values, original byte preservation, original download permissions, metadata access, WebP preview dimensions, unsafe file formats and private production notes. Existing checkout and administrator status-transition checks remain in place.

Back up the database and private artwork before release. Reverting application code does not delete these additive JSON fields. Keep original artwork and the matching upload records together when restoring. Older application versions served image originals publicly after publication, so a rollback to such a version would weaken original-file privacy; prefer a forward fix or retain the private preview/download endpoints when rolling back.

Preview conversion uses a bounded in-memory cache (16 MiB, at most 32 entries) keyed by the original's file version. Access authorization and original-file availability are checked before a cached preview can be returned. The cache is disposable and is not a substitute for original-file storage or backups. Sharing images honor original EXIF orientation without changing the stored file.
