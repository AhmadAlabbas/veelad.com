# Veelad Originals — Entertainment & Storytelling Library

**Status:** Production plan plus **20 implemented original SVG illustrations in development**. The remaining 220 concepts are not drawn and no artwork is published to the live store.  
**Scope:** 20 genre collections, 240 separately art-directed concepts: **60 new fictional characters**, **120 props/illustrated motifs** and **60 scenes/badges**.  
**Source of truth:** [Volume 01](./entertainment-volume-01.json), [Volume 02](./entertainment-volume-02.json), and the [32-concept flagship wave](./flagship-wave-01.json).

This is a proposed **first-party illustration programme for a clothing-design studio**, not a collection of screenshots, franchise art, celebrity portraits or branded merchandise. Twenty first-party illustrations now exist in `public/assets/entertainment-originals.js` and are connected to the development editor. They have individual SVG geometry, editable colours and raster export code. They are **not live or commercially cleared** until rights, translations and export QA are approved. The remaining 220 concepts have not been illustrated.

## Creative north star

Make a customer feel that they are browsing a thoughtfully art-directed illustrated world rather than seeing a thousand recoloured versions of one icon. Distinctiveness matters more than raw item count. Each illustration must have an identifiable silhouette at thumbnail size; each character must have its own body proportions, posture, clothing geometry and visual identity; scenes must tell a story; colour palettes must not be identical by default.

The library should let a buyer discover a polished graphic within seconds, place it on wearable products, change suitable colours, and trust the print export. The browsing experience must not advertise fewer assets as more by counting rotations, duplicate mice, recolours or decorative frames as separate original illustrations.

## Catalogue and creative briefs

| Collection | Direction |
|---|---|
| Midnight City Noir | Crime atmosphere and urban stories without using protected characters or scenes |
| Science & Wonder | Friendly inventors, laboratory objects and discovery |
| Escape, Codes & Strategy | Mazes, architecture, symbolic mysteries and puzzles |
| Small-Town Adventures | Coming-of-age journeys, friendship and local exploration |
| Retro Arcade Worlds | Independent gaming iconography and kinetic retro shapes |
| Cosmic Voyages | Invented astronauts, spacecraft and space travel |
| Neon Future City | Human-centred future transport and urban technology |
| Mythic Kingdoms | Invented folklore heroes, fantasy objects and heraldry |
| Enchanted Gardens | Distinctive botanical magic and garden characters |
| Desert Trail Stories | Nature, field photography and regional travel |
| Ocean Expeditions | Marine exploration, reef life and sea discoveries |
| Friendly Monsters & Oddballs | Distinct original creature designs with different anatomy |
| Romantic Comedy Moments | Everyday humour, relationships and tender details |
| Cinema & Filmmaking | Film equipment, behind-the-scenes craft and production stories |
| Action & Adventure Stunts | Athletic motion and adventurous outdoor scenes |
| Kitchen Stories | Cooking, cafés, baking and community rituals |
| Underdog Sports Stories | Fictional teams, local courts and perseverance |
| Music After Dark | Instruments, audio craft and performance without artist likenesses |
| Cozy Mysteries & Bookshops | Reading, clues, gentle intrigue and warm spaces |
| Eerie Folklore & Atmospheric Horror | Imagined folkloric figures, landscape and restrained suspense |

Each collection contains **three character briefs, six visual motifs, and three storytelling scenes/badges**. A pack's three-colour reference palette is only an **art-direction reference**; it must **not** be blindly applied to all 12 assets, which would recreate the same-colour issue already identified in the existing studio.

## Scope boundaries and rights

- **Do not reproduce** Breaking Bad, Prison Break, Stranger Things or any other movie/series characters, recognised costume silhouettes, character combinations, trademark logos, fictional brand names, specific scenes, plot-signature props, promotional art or famous dialogue. Do not market generic illustrations as official fan art or as associated with those properties.
- Avoid identifying exact performers or living people through portraits, likenesses or distinctive real-world styling.
- No protected game characters, sprites, level layouts, branded controllers or film-poster compositions.
- An original genre trope is a starting point, **not an automatic commercial-use clearance**. A trained reviewer must evaluate every finished design for substantial similarity and trademark/likeness risk. Remove or redesign anything too close.
- Use written IP assignment from commissioned illustrators or a licence explicitly allowing production, editing, sublicensing where needed, advertising and resale; archive agreements and source file provenance.
- Never generate search tags using third-party franchise names for SEO or imply a partnership.

## Asset contract (every individual piece)

Each completed asset must include:

1. Stable ID (already provided in JSON) and accessible, descriptive English name.
2. Approved original layered vector **SVG** with visually separated fill regions for `primary`, `secondary`, and `accent`; allow neutral `ink`/transparent where needed. Decorative elements must never inherit a hard-coded universal palette.
3. **Individually approved default palette** (three hex values) chosen for that asset. The pack palette is a mood reference, not an asset default. Verify light/dark fabric contrast and tasteful recolouring on all three slots.
4. Thumbnail at 90 px and 256 px; optional photographic garment mockups are separate from source designs.
5. 1400 px transparent PNG rasterisation and source vector retention. Explicit print-safe area, transparent background, colour space and supplier template constraints.
6. Name, brief and human-reviewed descriptive tags in English, Arabic and Simplified Chinese. Current JSON contains English names/search terms plus translated pack titles: item-level translation is **not yet done**.
7. `character`, `motif` or `scene_badge` type; topic/mood tags; editorial collection; colours; and provenance/licence documentation.
8. Asset-specific alt text; decorative animation must not be relied on for comprehension.
9. Submission version, review status, reviewer, approval date and hash of final SVG. Do not mark concepts as live.
10. Test fixtures ensuring that editor insertion, recolouring, save/reopen, undo/redo and server-side print preview retain fidelity.

**Production limitation:** Emoji glyph colour changes and genuine flag recolouring are different concerns. Genuine national flags retain canonical colours; do not override them with generic illustration controls.

## Creative quality rubric (100 points)

| Dimension | Points | Release criterion |
|---|---:|---|
| Recognisably original composition / silhouette | 25 | Distinct from every existing asset and known franchise |
| Illustration craft and polish | 20 | Coherent strokes, purposeful detail, balanced negative space |
| Thumbnail recognisability | 15 | Clearly identifiable at 90 px, not dependent on embedded labels |
| Editable colour system | 15 | Every advertised swatch produces meaningful change and readable contrast |
| Clothing / print viability | 10 | No hairline-only print details; supplier preflight verified |
| Search and naming | 10 | Relevant EN/AR/ZH search; no keyword spam |
| Licensing / provenance | 5 | Recorded first-party rights and independent rights review |

**Release threshold:** `>=90/100` **and** all mandatory gates. A rights failure, near-duplicate, broken SVG, visual/export mismatch, or fake asset count blocks publication regardless of score.

## Browser and editor experience

- **One card per distinct illustration.** Variants appear *inside* the editor as style options, not as repeated search results.
- Search English, Arabic and Chinese with typo handling, meaningful synonyms, semantic ranking and quick filters for genre, mood, artistic style, fabric contrast, colour and orientation.
- Cross-link character, accessory and scene in a common **Story Set**; let the designer build a composition from parts. Do not bundle an uneditable screenshot and call it layered.
- Each search card shows a real asset preview, translated name and save-to-favourites. Favourite controls must sit outside the vector image hit area.
- Fast progressive loading (48 results initially); avoid uploading full raster graphics before the user opens an item.
- Proper empty states, recent searches, favourites, clear filters, keyboard navigation and readable contrast in RTL layouts.
- Validate selected palettes and cached thumbnails after any asset revision; invalidate CDN cache with content hashes, not only unversioned script URLs.

## Execution sequence

**Phase 0 — Design review (no publication):** Validate the 240 concepts for independence, establish asset-level palette directions, edit/remove any generic or similar ideas, and complete item-level translations.

**Phase 1 — Flagship proof set:** Draw and test **32 finished source-editable assets**: 14 original characters, 11 motifs and 7 storytelling scenes, each with an independently chosen default palette (see the flagship manifest). Confirm real 90 px recognition, colour editing, private save/reload, print export parity, actual garment previews, and a multi-device browser run. Publish only approved pieces.

**Phase 2 — Full 240-concept collection:** Complete the remaining drawings, per-asset metadata, source vector files, provenance, rights and print QA. Release in curated packs, not a giant unverified bulk import.

**Phase 3 — 1,000 original illustrations:** Expand into 40–60 original genre and adjacent fashion-themed collections, using editor demand, favourites and verified sales to prioritise real gaps.

**Phase 4 — 10,000 genuinely distinct illustrations:** Scale through a reviewed illustration pipeline, separating originals from style variants and avoiding spam. A count is reached **only** when unique artwork has passed the acceptance rubric—not when code can generate 10,000 IDs.

## Operating metrics

Track zero duplicate art signatures, 100% recorded provenance, 100% export parity on QA samples, >95% search relevance on a human-rated EN/AR/ZH query set, less than 2 seconds to first rendered 48 results under the agreed test profile, and support for keyboard, touch, Arabic RTL and mobile. These are **targets**, not claims of current performance.

## Important project state

The two JSON files remain **240 creative briefs**. Of those, **20 now have SVG source implementations** in `public/assets/entertainment-originals.js`. The other 220 concepts have **no source artwork**. Do not list those 220 as available, and do not claim the new 20 are deployed to the live store until the release gate has passed. Parent studio changes may still have outstanding browser test issues; assess independently before merging or deploying. No payment, storefront or account settings should be changed by editorial planning.
