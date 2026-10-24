# Artist shops, private drafts and following

Artists edit their shop in **Artist studio → Shop settings**. The editor provides a separate private draft and public profile. Editing and autosaving never publish changes. **Publish profile** updates the public artist page; **Reset to published profile** explicitly replaces the private draft with the current public version.

## Presentation

- Profile photos are cropped in the browser to 1024 × 1024 JPEGs; cover banners to 2400 × 900 JPEGs. Sliders support horizontal/vertical framing and zoom. Only the cropped derivative is uploaded. These are presentation images, not print masters.
- Cropped images and portfolio uploads remain private until they appear in the published profile. The image endpoint permits their owner and administrators to preview them privately. Unpublishing an image removes its profile-based public access; another intentionally published use can still make it public.
- The artist can preview a laptop/phone layout and English/Arabic independently of the editing language. Missing Arabic content falls back to English. Product images are never mirrored for RTL.
- Profiles support six featured products, six named shop sections with up to 24 products each, and six portfolio images with English/Arabic captions. Only the artist's own products can be selected; only currently active listings appear publicly. Empty shop sections are hidden.
- The public shop initially renders at most 24 products and links larger catalogues into the existing paginated, filtered shop. Portfolio images preserve the full artwork inside their frame.
- The ten-item completion checklist helps artists improve their profile. It is not an artistic rating, a sales promise or a publication requirement.

## Draft integrity

The server validates image/product ownership and stores only allowlisted fields. Every draft mutation uses a version check and row locks; stale tabs receive a conflict instead of overwriting newer edits. A hash of the published profile also prevents an old draft from replacing edits made through legacy account controls.

Autosave waits for a pause in typing and limits its frequency. Explicit Save draft is always available. SPA navigation flushes pending edits; failed saves preserve the editor and return to its URL. A browser unload guard covers unsaved edits and image uploads. Drafts are server-side and survive successful saves/reloads; an unsaved offline edit cannot be guaranteed to survive closing the browser.

## Following and email choices

Signed-in customers and artists can follow other artists. Their following list and notifications are private. Following defaults to in-account updates; email is a separate unchecked choice requiring a verified account email and available delivery. Customers can manage each artist in My account.

Publication records are created transactionally on administrator approval. A baseline marks the currently active catalogue as already published, preventing backlog notifications on deployment. A bounded background task processes at most three releases and fifty followers per release each minute. Following after a release does not subscribe someone to older announcements. Unique notification keys prevent duplicate updates when a job restarts or a product is edited/reapproved.

Email updates use the existing SMTP queue, staging recipient allowlist, verified email checks and conservative retry rules. The mail worker rechecks the follow, email preference, account/artist status and product visibility immediately before sending. Disabling email or unfollowing expires queued/held messages. A message already handed to SMTP cannot be recalled.

Each update contains a signed link to an explicit stop-email page. It works without signing in, changes only that artist's email preference, and keeps the in-account follow. The page exposes no email address, password, private artwork or account details. Tokens grant only this limited opt-out capability. No external test messages are needed to validate the feature.

## Configuration and operations

`ARTIST_PROFILES_ENABLED` defaults on in local/test/staging and off in production. An explicit `false` disables the new routes. Payment behaviour and other production gates are unchanged.

Migration 015 adds `artist_profile_drafts`, `artist_follows`, `artist_notifications` and `artist_releases`. All four are included in encrypted backup and restoration, taking coverage to **60 tables**. The migration runner supports the publication baseline data statement as well as table DDL. Existing migration checksums stay unchanged.

Artist metadata and sharing images use the published profile. Draft fields never enter bootstrap, public artist pages, social previews or sitemap data. Existing registered artists and newly promoted artist accounts can use the editor; a promoted account's new public artist record is created when it first publishes.

Automated coverage includes draft/public separation, owned media, bilingual captions, two-tab conflicts, offline save recovery, crop output, device/language previews, featured sections, follow defaults, deduplication, SMTP consent checks, anonymous signed opt-out and nonempty backup/restoration.
