# Customer design studio

Customers can create private, made-to-order items at `/en/create` and `/ar/create`. They sign in, select an available product and option, upload PNG/JPEG artwork, adjust its placement, review the provisional preview, and add it to their bag. The same upload can be placed on another enabled product without uploading again. Personal designs never become public product listings.

## Administrator setup

In **Administrator → Products → Edit product**, enable **Allow customers to create their own design on this product**, then save. Only active, in-stock, explicitly enabled products are offered. Existing products remain disabled by default. Use suitable blank-product listings with accurate names, prices, options, stock and specifications; the preview uses the blank template for the category and replaces the catalog artwork with the customer's own artwork. Enabling customization does not change the existing product listing or its normal purchases.

The existing product's retail price, options and shared stock apply. No prices, supplier measurements or print costs are invented by the studio. Personal orders carry no artist attribution or royalty, because they contain the customer's artwork. Ordinary purchases retain the artist and royalty. Artists cannot enable this setting through their submission API. Check your fulfillment costs before enabling a product.

## Customer workflow

1. Open **Create your own** in the category navigation or mobile menu. Enabled product pages also link to the editor.
2. Sign in or create an account. The studio returns after authentication.
3. Select a real purchasable product and option. Upload one PNG/JPEG (25 MiB maximum, 60 MP maximum, minimum 100 pixels per side); a high-resolution transparent PNG is recommended. The minimum acceptance size is not a print-quality guarantee.
4. Drag, resize, rotate, fit/fill, center, repeat as a pattern, or change the print-area background. Arabic changes the controls and direction, while the physical artwork remains unmirrored. Source files are never changed. The editor accepts uploaded artwork; a text/vector drawing editor is not included.
5. Confirm the right to print the artwork and review the provisional preview. Subsequent placement/product changes clear the review checkbox.
6. Add the item to the bag. Continue with the same upload to create another product. Different designs and options have separate bag keys. Click a personalized bag image to reopen its saved layout; saving replaces that bag entry and preserves its quantity. Further edits create a new immutable saved design rather than changing any previous order.
7. Check out through the existing flow. The order remains `awaiting_payment`; no payment provider is enabled and no card details are collected. Artwork quality and supplier specifications must be confirmed manually before production. Do not print solely from the web preview.

The current in-progress editor is retained in browser memory during navigation/language changes. After a full reload, only designs already added to the account bag can be reopened. Originals are retained in private storage, including abandoned uploads; there is no automatic retention/deletion job in this release.

## Privacy and production

- A signed-in account is required to upload and order personal artwork. Owners and administrators can view its bounded WebP previews. Other customers, anonymous visitors and unrelated artists cannot access the originals, metadata or private previews by knowing their IDs.
- Private source files remain byte-for-byte originals in `UPLOAD_DIR` with mode `0600`; the server creates a separate photographic mockup. The artwork is not sent to an AI or third-party editing service.
- Saved `customer_designs` are immutable and owned by one user/product. IDs are content-derived for safe identical-save retries. State and checkout validate ownership, current product eligibility, category, options, quantities and stock. Checkout uses current server prices and snapshots the original, mockup and placement into each order line.
- Personal order lines have `artist_id: null` and `royalty_percent: 0`, so they do not enter an artist's order dashboard. Administrators see **Customer-designed item**, its preview, the original-file download and its specific placement-plan download in **Manage order**.
- Multiple personalized lines can refer to one product. Use the exact `line_id` when downloading an order placement plan; product ID alone is rejected if ambiguous. The plan includes the option, quantity and provisional template information. An administrator can still download an ordered design after the catalog changes or customization is disabled.
- These are provisional photographic preview templates, not supplier-certified product specifications. No physical printing or delivery integration is introduced.

## Migration, backups and rollback

`004-customer-designs.json` adds an indexed `customer_designs` table without changing existing records. Staging startup applies additive migrations automatically; local/manual environments use `npm run migrate`. Any future production release requires its own reviewed migration and separate environment/secrets as described in the deployment documentation.

Encrypted backups now include the new table and all private upload files. Pre-feature backups remain readable and restore with an empty `customer_designs` table. The existing storage/backup/alert configuration remains necessary; adding this feature does not resolve any previously missing files or failed backup jobs. Verify a successful backup and restore rehearsal before enabling production.

To stop new custom orders, disable the checkbox on the affected products. Existing orders and production-file snapshots remain intact. For code rollback, keep migration 004 and its data; do not drop it or delete any private artwork. A pre-feature application cannot correctly display or fulfill personal orders, so continue using the current administrator order/download handling for existing personal orders until they are fulfilled or cancelled. Preserve the database and upload directory together.

## Verification

Automated tests cover signed-in uploads, disabled-product rejection, ownership/rights/review enforcement, immutable save retries, separate designs on one SKU, price tampering, stock rollback, private previews after ordering, exact original bytes, line-specific order plans and encrypted backup/restore. Desktop and iPhone-sized Chromium workflows cover administrator enablement, customer registration return, upload reuse on a T-shirt and notebook, Arabic/English switching, saved bag editing, reload, unpaid checkout and administrator downloads. Native Safari and physical supplier samples require separate device/production validation.
