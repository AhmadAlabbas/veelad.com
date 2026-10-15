# Artwork preparation and customer approvals

Administrator → **Production** groups open orders by preparation stage. Search by order, customer or product, then open the order. Each line shows its captured product option, quantity, original, saved placement and text. Original downloads preserve uploaded bytes; composed PNGs and placement plans use the immutable checkout snapshot. The shipping address remains in the administrator workspace.

1. Check originals, placement/text, options and quantities. Save the preparation checklist and private team notes. The separate customer update is visible on tracking; internal notes and checklist details are excluded from customer APIs.
2. Upload a checked PNG/JPEG product proof for **each exact order line**. Include a short explanation. Proofs are private and do not replace printing originals. Each proof stores a SHA-256 digest; changed bytes are refused on viewing, approval and print preparation. A revised proof supersedes the earlier request while retaining its response history.
3. Customers open My orders → View order, or use their private guest tracking link. They review the image and approve it with the explicit confirmation, or request changes with feedback. Only the latest pending version can receive a response. A changed order revision requires reloading; administrator accounts cannot approve on another customer's behalf.
4. Once every line is approved and preparation checks are complete, the order becomes ready for printing. Printing also requires recorded payment. No live payment integration is enabled by this change.
5. Move through printing → quality check → packed. Confirm print quality and packaging before the respective steps. Shipping is blocked until a production-managed order is packed. Dispatch/tracking stays manual and uses existing order controls.

New customer-customized orders enter this workflow automatically. Existing catalog orders can be enrolled by saving production progress or sending a proof. Existing legacy fulfillment remains compatible until enrollment. Cancelled, shipped and delivered orders cannot receive production edits. Once printing starts, proofs cannot be replaced or stages moved backward. Contact the customer and handle an exception separately instead of editing an approved printed record.

Approvals confirm the specific uploaded proof and checkout options, not supplier certification or payment. All current print measurements remain provisional; verify materials, printable areas, color and a physical sample before real production. Customer updates and approvals work in the website without SMTP. No email/push delivery is claimed.

# Artist submissions

In Artist studio → Upload artwork, upload one original and select requested products. Adjust each preview. Enable **Create a separate listing for each requested product** to submit two to seven independent listings together. The batch is atomic and retries do not duplicate it. Each listing references the same private original, carries its own category/mockup/placement, starts as a draft or pending review, and requires its own administrator pricing, stock and approval. Existing one-listing submissions remain available when the option is off.

In My products, **Reuse this design** opens a new submission with the same original and details, leaving the source listing intact. Administrator feedback remains visible when editing a listing that needs changes. Drafts, originals and pending listings are private.

# Designer controls and checks

The shared designer has undo/redo (up to 60 local editing states), preview zoom, directional touch buttons, center guides and optional center snapping. Zoom affects display only; artwork coordinates remain the same in English and Arabic. Customers retain server autosave and device recovery for their current draft; undo history and zoom are session controls.

Warnings flag provisional DPI/crop issues, opaque images and text near/outside the provisional safe area, using the same shaped text glyphs as rendering. Warnings are guidance and do not certify a supplier print template. Large originals remain unchanged. Use supplier specifications and physical samples when available.

# Data, rollout and rollback

No new schema migration or environment variable is required. Production state, proof references, approval decisions, checks and bounded history are additive fields inside the existing order JSON. They are included in encrypted backups through the orders table; proof images are normal private upload records. Customer originals and previous snapshots are never rewritten.

Deploy this revision to staging after required Node and desktop/mobile browser checks. Verify the exact health revision, private proof access and language layouts. Production deployment remains separate. Roll back application code without deleting order data or private files; an older application will ignore production fields and will not enforce the new approval gates. Pause fulfillment during such a rollback. Preserve backup files and use the current restore tool, especially for explicitly incomplete snapshots.
