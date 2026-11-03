# Priority 7 — Premium storefront refinement

Scope: staging-only homepage, product-card, desktop navigation and mobile layout quality. Preserve the user's approved grouped language/currency control, wide search bar, visible Partners, working Create menu and black/white Veelad identity with `#9B81EF` accents.

## Changes
- Replace one repetitive non-product homepage panel with a clean editorial feature of three distinct published designs. This feature only renders when three genuinely approved, non-sample designs exist; fallback is no panel rather than fabricated products or stock claims. Links open actual product pages. Product name and artist text are escaped. Wording exists for English, Arabic and Simplified Chinese.
- Improve typography hierarchy, editorial white space, card image presentation, prices, hover, keyboard focus indicators and minimum quick-add targets. The existing quick-add and save implementations are unchanged.
- Refine desktop visual states without altering tested search/navigation columns or preference arrows. On phones, improve hero padding, featured image sizing, two-up editorial tiles with 320px one-column fallback and accessible action sizes.
- Reduced-motion settings disable nonessential animations; RTL arrow direction is respected.

## Non-goals and safety
- No new product templates or unverified merchandise, AI-generated product photos, supplier attributes, checkout or payments.
- No API endpoints, schema changes, account or user-data modifications. Only published catalogue data is rendered.
- Production `veelad.com` is unchanged. Staging must be confirmed by exact deployment SHA.

## Acceptance testing
- `tests/premium-storefront.test.js`: real catalogue picks, no fake/sampled/unapproved items, escaping, locale strings and empty-catalogue fallback.
- `tests/browser/premium-storefront.spec.js`: approved product link navigation and 320/390/760/1024/1366/1920px horizontal overflow, quick-add minimum touch target, menu and partner visibility.
- Existing `tests/browser/home-editorial.spec.js`, `header-redesign.spec.js`, `storefront.spec.js`, `mobile-shopping.spec.js` also guard existing interactions.
