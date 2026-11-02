# Priority 4 — Product Customization Placement Assistant

This staging-first release improves the existing supported customer editor. It does not fabricate supplier-approved clothing models.

## Implemented
- T-shirt front and back remain separate editable and saved scenes.
- Placement Assistant includes centre chest, left/right chest, wide/lower front, upper/centre/lower back and generic placements for other existing product templates.
- Rotation-aware Fit within safe area shrinks or moves the selected element without distorting or enlarging images. Large text is refused if it cannot fit.
- Copy selected layer to opposite side creates a new independent layer ID, reuses the same authorized original and never overwrites other artwork. Existing whole-side copy still requires confirmation.
- The mouse editor, previews, undo/redo, colours and editable text remain available. Preset names support English, Arabic and Simplified Chinese.

## Limitations
The actual public/assets/print-products.json contains seven generic product types, including the two confirmed projected T-shirt illustration views. Some are non-wearables and do not represent the intended final clothing-only store. Sleeves, hoodies, polo, caps, sweatshirts, crop tops, bodysuits and other garments do not yet have genuine supplier templates or measured printable areas, and are not represented as if they do.
All normalized safety regions are provisional visual guides, not verified manufacturer print-safe areas. Manufacturer dimensions, garment colours/materials, print bleed and test samples must be validated before final fulfilment. Checkout, payments, products, prices, inventory, user permissions and production remain unchanged.

## Verification
- tests/placement-assistant.test.js checks rotation, safe geometry, labels in three languages, invalid inputs, image ratios and independently valid T-shirt sides.
- tests/browser/placement-assistant.spec.js exercises actual image upload, chest placement, non-destructive back-side layer copying, back placement and preview.
- Run npm run check, npm run build, npm test and desktop/mobile Playwright. Merge to staging and verify the actual health SHA.

Rollback involves restoring the previous staging commit, preserving saved private customer designs. No schema change or data rewrite is required.
