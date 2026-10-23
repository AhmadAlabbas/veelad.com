# Veelad Node.js migration

Runnable Node.js 24 LTS / Express 5 / MySQL backend with the existing buildless storefront. `public/` is the marketplace frontend; `reference/coming-soon/` retains the production landing page. PHP reference files are never served. The ZIP and its unmapped private artwork remain outside Git.

The original handoff was a reference implementation, not an imported customer database. The application now includes Google sign-in and a gated Partners program; live payment-provider processing and automated bank transfers remain disabled. See the setup guides below before enabling new services.

## Run locally

Requires Node.js 24 and Docker Compose (or an existing MySQL 8 database).

```sh
npm ci
npm run local:init
# Local database only; never use this passwordless container for hosting.
docker compose up -d --wait
npm run migrate
npm run local:provision
npm start
```

Use the local server on port 3000. `var/local-admin.json` contains randomly generated local-only admin access; it is ignored and private. Register customer and artist accounts through the storefront. The local demo catalog is explicitly seeded; its artists are sample profiles, not imported accounts. Re-running initialization/provisioning preserves existing local configuration and accounts.

```sh
# Create a separate disposable test database using your local administrator.
docker compose exec db mysql -uroot -e 'CREATE DATABASE IF NOT EXISTS veelad_test'
npm test
# Start the local app before browser tests.
npx playwright install chromium
npm run test:ui
# This cloud machine has Chromium installed:
CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
npm run check
```

`DB_TEST_NAME` defaults to `veelad_test` and must end in `_test`. Integration tests DELETE records in that database, never use a staging/production name. Browser tests create fictional accounts, artwork and orders in the local database and should not point at production. Repeated runs may hit the deliberately enforced rate limits; wait for the next 15-minute window or clear only your disposable local test rate counters.

## Deployment and compatibility

- [Hostinger/GitHub deployment and release gates](docs/DEPLOYMENT.md)
- [Initialize production with an empty catalogue](docs/EMPTY-PRODUCTION-STORE.md)
- [API contracts and schema](docs/API.md)
- [Database import, migrations and rollback](docs/DATABASE.md)
- [Validation and known limitations](docs/VALIDATION.md)
- [Product photos, specifications, delivery and returns editing](docs/PRODUCT-PAGES.md)
- [Mobile navigation, filtering, options and cart controls](docs/MOBILE-SHOPPING.md)
- [Artist drafts, feedback, profiles, discovery and normal page URLs](docs/ARTISTS-DISCOVERY-SEO.md)
- [Guided designer, editable collections, print job sheets and launch rehearsal](docs/EXPERIENCE-REFINEMENTS.md)
- [Private storage, encrypted backups, recovery and monitoring](docs/OPERATIONS.md)
- [Transactional email setup](docs/EMAIL.md)
- [Veelad Partners: affiliate operations, financial controls and gated setup](docs/PARTNERS.md)

No frontend build is required. Hosting build: `npm ci --omit=dev && npm run build && npm run migrate`. Start: `npm start`. `npm run build` records the actual Git SHA; when Git metadata is absent set `DEPLOY_COMMIT` to the deployed full SHA. Health returns this revision so automation cannot mistake an old or PHP deployment for the new release.

Staging also runs the additive migration automatically after opening HTTP, using the Node runtime's private database settings. Missing Node session tables no longer require an SSH command or manual SQL import. While the schema is being prepared, API requests return 503 and the storefront retries automatically for up to 30 seconds. Startup never seeds or replaces existing records. Production does not run this startup migration: its schema remains part of the deliberate, backed-up release process.

Runtime choice: Node's [official release schedule](https://nodejs.org/en/about/previous-releases) identifies Node.js 24 as the LTS line. Express 5 requires Node 18 or newer ([official installation documentation](https://expressjs.com/en/starter/installing.html)). The application is tested with Node 24.19.0. Do not select an unpinned “latest” runtime. Hostinger documentation requests were blocked from this machine, so the user confirmed Node 24 in hPanel, while live deployment capabilities still require account configuration.

For design-style discovery, the expanded homepage, owner-managed prices and disabled Moyasar preparation, see [Catalogue launch](docs/CATALOGUE-LAUNCH.md).

For the global storefront, neutral mockups, model galleries, confirmed product choices and delivery-country controls, see [Global storefront](docs/GLOBAL-STOREFRONT.md).
