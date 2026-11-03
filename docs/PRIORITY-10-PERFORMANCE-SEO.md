# Priority 10 — Performance & Search Engine Optimisation

Staging-first hardening of the existing Veelad marketplace. No production deployment, new products, checkout, payment activation or external analytics/tracking.

## Baseline (measured from staging repository assets)

- **68** classic JavaScript scripts loaded on every storefront page, totalling approximately **3.51 MB** before any HTTP compression. Their previous classic script tags made the HTML parser wait for each script as encountered.
- **35** stylesheet URLs (approximately **433 KB**) are used across the site. No risky stylesheet reordering/splitting has been introduced: the design system, editor, checkout layout and mobile navigation still share many cascade rules.
- CSS-backed artwork and editor flags/fonts must remain accurate; do not remove or relabel these assets just for a size metric.

## Improvements

1. **Ordered `defer` for all 68 non-module scripts**. Browser downloads can overlap without parser blocking, while execution retains the original dependency order. No conversion to ES modules or async script race conditions.
2. **Immutable public static caching scoped to the exact deployment SHA**. Assets requested with `?v=<current 40-character Git commit>` receive `Cache-Control: public, max-age=31536000, immutable`. Unversioned assets and old commit URLs get a short, revalidating five-minute cache. APIs, HTML, customer uploads, private designs and the fulfillment portal are not served under this policy.
3. **Same-URL LCP preload** for the first homepage hero: `/assets/lifestyle/homepage-editorial.webp?v=veelad-neutral-2`. Only the home route preloads it, and the URL exactly matches the existing slideshow's image source. Subsequent slide images remain lazy where already configured.
4. **Reduced external font handshake cost** by preconnecting the existing Google Fonts destinations. No new external font providers.
5. **Page-level SEO**: localized canonical URLs and existing three-language hreflang remain; omit alternate clusters on explicitly non-indexable/private/query pages, add OG image alt/site name and Twitter card title/description/image, and emit crawler headers matching the existing robots metadata. Staging retains `robots.txt: Disallow: /`, `noindex, nofollow`, and an empty sitemap. Production-only approved public catalogue and Journal continue to generate the published sitemap.
6. **Accessibility guardrails**: existing main landmark/skip link, RTL languages, localized descriptions, contrast/touch sizing, and secure no-JS fallback preserved. No late-loading library that would remove creator features on in-app navigation.

## Verification

- `tests/priority10-performance-seo.test.js`: script order/defer, static caching, all 3 localized homepages, canonical and social metadata, LCP URL, staging/checkout/account/filtered noindex, robots and sitemap.
- `tests/browser/priority10-performance-seo.spec.js`: fully loaded storefront and catalogue, Arabic/Chinese layout, editor artwork library integrity, matching preload, script load order and browser error detection.
- Standard Node backend, build, and full Playwright regression must be checked. Confirm live Hostinger revision matches merged SHA and examine `Cache-Control`, LCP preload, and `X-Robots-Tag` on staging.

## Known next steps outside the staging code release

- Actual Lighthouse/Core Web Vitals field metrics require a real audited browser/performance run and traffic; do not invent a Lighthouse score or promise a ranking improvement.
- The large shared creative and flags bundles remain loaded across pages. Route-aware code splitting is a subsequent, higher-risk project requiring more extensive Studio regression coverage, not something to silently force into this release.
- Public SEO indexing for production must be enabled only after actual products, policy translations and payments/fulfillment are launch-ready, subject to a separate production deployment.
