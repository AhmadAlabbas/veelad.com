# Priority 6 — Accurate product discovery

This staging release improves existing catalogue discovery rather than introducing unverified products, pay-to-play ranking, customer tracking or purchasing changes.

## Implemented
- Product searches understand popular synonyms for the seven *existing* real catalogue categories in English, Arabic and Simplified Chinese. Category alias searches only return products actually present in the approved catalogue. No garment is invented.
- Result ranking continues to prioritise matching title/tags/artist and category, now including category synonyms for relevance.
- Verified colour, material, fit and occasion filters show counts against all the OTHER active filters; the selected facet alone is cleared when computing each choice. A selected option with zero results remains visible as 0 so it can be changed without hiding the filter entirely.
- Similar items on product pages are chosen from active/published products and scored using verified matching attributes, design styles and tags, artist/category similarities and a small in-stock tie-breaker. Same design-family duplicates are omitted; unpublished products are never recommended.
- Existing global-search keyboard controls, mobile filter removal, product category/style navigation, price/availability sorting and the full multilingual catalogue remain intact.

## Quality / privacy boundaries
- No cookies, automated profiling, user browsing history or personalization based on private data introduced. No inferred physical attributes: filtering only reads supplier/administrator-confirmed discovery attributes.
- Checkout, payment processors, sales status, pricing, inventory and product publication are unchanged. Production domain is not deployed.
- The canonical catalogue's category list currently also includes non-wearables. This release does not relabel those as clothing or manufacture hoodie/sleeve templates.

## Verification
- tests/discovery-priority6.test.js: multilingual search terms, true zero results, constrained verified facets and product recommendation privacy.
- tests/browser/discovery-priority6.spec.js: public shop three-language type search and conflict with selected category.
- Existing tests/discovery.test.js, tests/browser/storefront.spec.js, tests/browser/shopping-quality.spec.js and the full GitHub Actions suite must continue to pass.
- After merge, check staging health revision for the merged SHA. Test actual public shop rendering on staging, then separately authorize any production release.
