# Start production with no designs

The owner chose an empty production catalogue on 2026-10-21. Keep the staging
catalogue and its private files on staging. Do not copy its sample products,
fictional artist profiles, accounts, test orders, mail queue or authentication
records to production.

## Database initialization

The owner created a separate production database and imported migrations 001–007 through
phpMyAdmin. The disabled-marketplace health check subsequently returned HTTP 200
for the production environment. This check confirms access to the migrations
table; it does not confirm store settings, an administrator or upload storage.

After verifying the selected production database, run
[the empty-store initializer](sql/empty-store.sql) in phpMyAdmin. It inserts the
missing `settings.store` row only, preserving an existing row. It creates no
accounts, artists, products, orders or artwork. Checkout is disabled, coupons are
disabled and curated collections start empty. Zero shipping amounts are inactive
placeholders, not a confirmed delivery price. Confirm delivery settings before
ever enabling checkout.

For phpMyAdmin verification, replace `YOUR_PRODUCTION_DATABASE` below with the
actual database name and qualify the schema explicitly. Its interface may
change the selected schema when a query refers to `information_schema`:

```sql
SELECT COUNT(*) AS application_tables
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'YOUR_PRODUCTION_DATABASE' AND TABLE_TYPE = 'BASE TABLE';

SELECT COUNT(*) AS applied_migrations
FROM `YOUR_PRODUCTION_DATABASE`.`schema_migrations`;

SELECT id, JSON_EXTRACT(data, '$.checkout_enabled') AS checkout_enabled
FROM `YOUR_PRODUCTION_DATABASE`.`settings`
WHERE id = 'store';

SELECT COUNT(*) AS product_count FROM `YOUR_PRODUCTION_DATABASE`.`products`;
```

Expected: 23 tables, 7 migrations, one store row with `checkout_enabled=false`,
and zero products. Do not delete records to force those counts if unexpected data
appears; inspect the selected database and the unexpected records first.

## Release and owner access

Keep `PRODUCTION_MARKETPLACE_ENABLED=false` while completing setup. Publish the
latest validated staging revision through the existing deliberate production
release process. The production branch previously held an older release; changing
the marketplace flag does not update application code.

Provision an administrator privately with the existing `npm run provision`
command, without `--demo`, through supported private Node execution. Its
`ADMIN_EMAIL` and `ADMIN_PASSWORD` values must come from private environment
variables, never the SQL file or repository. Do not rerun that command once an
administrator exists. New customer or artist registration never grants
administrator privileges. This SQL initializer does not provision an admin.

Configure and verify a separate persistent private production upload directory,
backups, the production Google client and production email delivery. Staging
credentials, paths and callback URLs must not be copied as production settings.
Keep real and simulated payments disabled. Checkout remains paused until products,
supplier specifications, prices and delivery terms have been reviewed.

Only then enable the marketplace to expose the empty storefront. Verify English
and Arabic home, shop, registration and creator pages, plus actual owner sign-in.
The seven customizable categories remain visible but unavailable until real
eligible products exist. Empty pages must not fall back to demo products.

## Validation

`tests/browser/empty-catalogue.spec.js` uses an isolated disposable local database.
It exercises the SQL initializer and its repeat import, both storefront languages,
all three homepage slides, an empty shop, seven unavailable customization
categories and registration. It checks that these visits do not create accounts,
products, artist profiles, uploads or orders. Desktop and iPhone-sized Chromium
checks are local tests, not proof of physical Safari or Hostinger services.
