# Product photos and information

The product page includes a thumbnail gallery, enlargement dialog, close-up of the primary preview, stock status, option selector, materials/dimensions/care table, size guide, delivery card and return information. Product navigation refreshes the catalog and settings so new approvals and policy changes appear when a shopper opens the product. Existing catalog previews are retained. A close-up is explicitly an enlarged view of the same image; new photographs must be supplied by the artist or store team.

## Add product details

In **Administrator → Products → Edit**, fill Materials, Dimensions / fit, Care instructions and Size guide. These fields are optional. Use confirmed measurements and units; nothing is inferred from the product category. Leaving a field blank shows that its details are not available, and the guide offers a product-specific contact link. The contact form prefills the product title in its subject.

Artists upload designs and private production notes; Veelad’s administrator confirms the final retail price, availability, options, materials, measurements and care information. Editing an artist listing returns it to pending review. Administrators review the product information along with the artwork before publishing.

## Add photographs

The primary artwork/image remains supported. Use **Additional product photos** to upload up to six additional PNG/JPEG files, each up to 8 MB in the gallery editor, with at least 100 × 100 pixels and no more than 60 megapixels. Primary design uploads accept up to 25 MiB. The server validates and keeps original bytes privately; the controlled image endpoint generates WebP previews up to 1600 pixels per side and removes preview metadata. Save the listing after uploading; Remove detaches a photograph from the gallery without deleting the stored file.

An upload must belong to the submitting artist, already be attached to their own listing, or be selected by an administrator. Artists can retain and view photos administrators have already added to their listings. Pending or archived photos are accessible only to the upload owner, the assigned listing's artist or an administrator, unless referenced by another active approved listing. Approval publishes the gallery; artist resubmission removes public access until approval again. No external image URLs are accepted and the upload directory is not made public.

## Delivery and returns

In **Administrator → Store settings**, fill Delivery estimate and Return policy. Product pages continue using the existing shipping charge and free-delivery threshold. The new text is displayed exactly as entered, as escaped plain text with line breaks. Leave it blank until the business has confirmed the terms; the page then directs customers to support. This change does not process payments, shipping, returns or refunds.

## Data and rollback

Product fields are stored in the existing `products.data` JSON and the policy fields in `settings.data`. No new database migration is required, and existing records and images are retained. Requests that omit the new fields preserve previously saved values; explicitly submitting an empty string/array clears that field. The existing API paths, cart options and server-side price calculations remain compatible.

Application rollback uses the existing tested revert/release process. Older releases render their original product page and do not understand gallery fields; retain a private database backup and pause edits if reverting to an old product editor that would discard unsupported fields. Private uploaded files are not removed during this feature rollout. Their deployment persistence still depends on the hosting storage arrangement documented in DEPLOYMENT.md.

Arabic and English pages share the same product ID. Administrators can edit language-specific descriptions, specifications and policies; artists provide bilingual design titles, descriptions and tags. See [I18N.md](../I18N.md) and [DESIGN-PRODUCTION.md](DESIGN-PRODUCTION.md). Retain the bounded-preview and private-original download endpoints during any rollback after accepting production originals.
