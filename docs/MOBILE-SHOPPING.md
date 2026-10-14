# Mobile shopping

The storefront uses the existing design with additional shopping controls. No new environment variables, dependencies or database migration are required.

## Navigation and filters

At phone widths (760 px and below), the storefront shows a bottom navigation bar for Home, Browse, Saved, Bag and Account. It is hidden in administrator/artist workspaces and during checkout. The menu provides account, saved designs, bag, tracking, categories and support links. Safe-area padding keeps the navigation above a device's bottom inset.

The mobile shop replaces the inline filter row with a Filters & sort panel. Category, artist, maximum price and sorting can be changed together; Show results applies them and closes the panel. Reset resets the panel's filter values without applying them. Active filter chips can be removed individually. Changing categories preserves search, artist, price, sort and gift-tag selections; Clear filters retains the search and sort choice. Desktop keeps its inline filtering controls.

## Product options and cart

Product options use native radio controls with large labels, visible selection and keyboard navigation. The selection is retained while browsing or saving that product within the current page session. The phone Add to bag action remains visible above the bottom navigation. Existing quick-add dialogs remain supported.

Cart quantity buttons have 44 px targets and item-specific accessible labels. Decrease stops at one; Remove is explicit. Increase stops at 20 per line or the product's shared stock limit across variants. A stock reduction does not prevent decreasing an excessive quantity; the cart warns when adjustment is needed. Quantity changes retain scroll and focus. Product, bag and checkout views refresh current catalog/settings when opened. The server still validates stock, options, prices and final totals at checkout.

The bag shows progress toward free delivery using the subtotal after any discount. Phone bag and checkout pages display the current estimated total and action in a fixed bottom bar. It uses the existing checkout link or form-associated submit button, preserving required-field and consent validation. Contact/address controls use readable input sizes, and narrow-screen address forms use one column. No payment provider or real charge is enabled.

## Verification and rollback

Desktop and emulated phone tests cover menu links, filter preservation/removal, option selection, cart bounds, decreasing after a simulated stock reduction, scroll preservation, explicit removal, required checkout fields and viewport fit down to 320 px. The existing product-gallery, customer checkout/tracking and artist/administrator approval tests also run. This does not establish behavior on a physical device or Safari; test those before production release.

The feature is a frontend change. Follow the normal tested revert/release procedure to roll it back; database records and uploaded files do not need a schema rollback. Production releases remain separate from staging.
