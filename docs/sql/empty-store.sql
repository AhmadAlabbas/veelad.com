-- Initialize a NEW, EMPTY store after applying the database migrations.
-- Select the intended production database in phpMyAdmin before running this.
-- Existing settings are preserved. No accounts, artists, products or files are added.
-- Shipping amounts are inactive placeholders; configure them before enabling checkout.
INSERT IGNORE INTO settings (id, data) VALUES (
  'store',
  JSON_OBJECT(
    'store_name', 'Veelad',
    'announcement', 'Art you love. Things you use. Made for you.',
    'announcement_ar', 'فن تحبّه، على أشياء تشبهك.',
    'support_email', 'info@veelad.com',
    'checkout_enabled', JSON_EXTRACT('false', '$'),
    'shipping', 0,
    'free_shipping', 0,
    'coupon_code', '',
    'coupon_percent', 0,
    'curated_collections', JSON_ARRAY()
  )
);
