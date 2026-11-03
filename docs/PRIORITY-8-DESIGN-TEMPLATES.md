# Priority 8 — Design Templates / Veelad Template Atelier

## Scope
A first-party, searchable gallery of **240 editable design compositions**: 48 original vector artworks × 5 distinct layout systems (Gallery Print, Signature Seal, Left Editorial, Right Editorial, Minimal Mark). These are *compositions*, not 240 individually drawn illustrations or confirmed print-ready products. Existing eight artist-inspired starter layouts and the original design library stay available.

## Customer functionality
- Open the private Studio → **Layouts** → **Design templates**.
- Browse the first 18 thumbnail compositions; load more, search by English, Arabic or Simplified Chinese text and tags; filter by one of 8 collections and one of 5 compositions.
- Each preview draws the actual local first-party vector art and locates a headline and smaller caption in its intended layout.
- Selecting a composition **adds** exactly one existing artwork image layer and two **separately editable text layers** to the current product side. No prior layers are deleted. Users can move, rotate and resize the artwork and the text, recolour editable artwork with the existing library controls, edit typography, and undo/redo. Studio autosave persists the user's own private composition, not a published catalogue listing.
- Capacity checks reserve three available slots per side and across the design (max 24 per side, 120 across the design). Invalid IDs are ignored and the existing account/ownership/upload controls remain in place.
- Text defaults and gallery headings are localized for English, Arabic and zh-CN. Artwork is first-party; third-party logos/fonts are not included.

## Guardrails
- Supplier print areas remain provisional, and the library never claims supplier certification.
- This release does not add invented apparel, shipping prices, checkout, payment or real-order processing.
- Avoid rendering all 240 full-size SVG artworks at once: only 18 initially, pagination in groups of 18.
- Existing eight starter layouts and 48 original artworks remain available in the same Studio layout panel; they are not overwritten.
- Staging only. Never deploy this branch to production without a separate explicit release decision.

## Tests and verification
- `tests/premium-templates.test.js`: 48 real assets, 240 unique IDs, geometry, independent unlocked layers, multilingual search, layout filters and missing ID handling.
- `tests/browser/premium-templates.spec.js`: authenticated, isolated local designer, searchable gallery, filtered layout, 3 editable image/text layers, existing workspace and privacy behavior.
- Existing Studio, asset, history, and customer-design suites run unchanged.
- Confirm deployment by exact `/api.php?route=health` staging revision and verify visual behavior in browser.
