# Pre-launch hardening

This release addresses the first three remediation groups. It does not activate real payments, settle earnings or deploy production.

## Request and dependency protection

- Multer 2.5 and Nodemailer 10.2.1; body-parser 2.4 through the updated lockfile. The verified npm audit returned no advisories.
- Compressed JSON requests are rejected; browser JSON requests are uncompressed.
- Upload authentication, administrator checks for restoration, and IP/account rate limits execute before multipart buffering. At most four upload requests are admitted concurrently per process, retained until response completion/disconnect. Size restrictions remain 25 MiB per original.
- Password changes allow 10 verification attempts per account and 15 per IP in 15 minutes. Rejected attempts count; password and session rotation are unchanged.

## Visuals and messages

The avatar crop uses a dedicated class rather than the generic avatar class. Tests compare crop/canvas geometry in both languages on desktop and phone viewports. The brand spark is an inline SVG, avoiding platform emoji substitution. Physical Safari testing remains useful and was not simulated as a real device test.

Checkout snapshots its language. Received-order and status-change emails use that language, Arabic item names/options when present, and normal `/ar/track` or `/en/track` links. Existing orders without a stored language retain English. Recovery and verification templates are unchanged. Tests use held mail and fake transports; no real test messages are sent.

## Catalogue delivery

The bootstrap protocol accepts `X-Veelad-Catalogue`:

- `deferred`: metadata and account state without product payload;
- a known catalogue revision: omit products only when the current published catalogue matches;
- `full` or no header: return products, preserving older client/API compatibility.

The browser delays product loading on account/login/help/policy/tracking pages. It fetches products when shopping/search needs them and revalidates prices/stock before product/cart/checkout flows. Null means an intentionally omitted unchanged payload, not an empty catalogue. Guest bags survive sign-in from a fresh login page: products are loaded before merging guest cart lines. Draft/private products remain excluded.

This reduces network retransmission and removes the duplicate public-product query inside bootstrap. It does **not** implement server-side search pagination or split all editor JavaScript. Bootstrap still reads active products to validate revisions/collection visibility. At substantially larger catalogue sizes those are further performance tasks; no misleading claim of constant-cost database reads is made here.

## VLD2 encrypted backup format

New `.vbackup` files contain independently authenticated AES-256-GCM artwork records and an authenticated compressed SQL manifest. Artwork is read/encrypted/restored one file at a time; image bytes are not embedded as base64 in a giant JSON document. The manifest binds filenames, offsets, sizes and SHA-256 digests, and each artwork record authenticates its filename as additional data. Temporary files are private and exclusive; only a completely verified archive is renamed to its final name. Missing artwork is explicitly reported as a partial backup.

Limits: 25 MiB per original, 128 MiB uncompressed database manifest, 32 GiB archive. These are bounded safety limits, not a claim of unlimited disk capacity. Hostinger storage quotas/free space must be checked independently. Legacy VLD1 archives remain readable with their original safety limits. Keep previous archives and recovery keys.

The restore rehearsal streams the archive hash, restores into connection-local temporary SQL tables and an isolated private folder, verifies rows and file hashes, then removes those temporary targets. Production restoration remains opt-in through the separate isolated recovery procedure; this release does not perform production restore operations.

Tests include 500 synthetic originals totaling more than 126 MiB, complete restore/cleanup, wrong-key rejection, tampered ciphertext, partial snapshots and backward compatibility. The test originals are byte fixtures, not product artwork or printer proof samples.

Off-site backup custody, retention policy and recovery-key escrow still require hosting/storage access. Same-server backups are not an off-site disaster-recovery guarantee.

## Monitoring and GitHub controls

The monitor now checks readiness JSON for both environments, requires healthy storage and a fresh successful backup, and fails on missing/stale/incomplete restoration evidence. It intentionally reports the current production recovery gap instead of treating homepage HTTP 200 as sufficient.

Scheduled GitHub workflows run from the default branch. The updated monitor becomes scheduled only after this reviewed workflow change reaches that branch. No production application deployment is required to review this code, and no external alert-delivery test was sent.

GitHub returned HTTP 403 `Resource not accessible by integration` when attempting branch protection and a protected production environment. An account administrator must apply:

1. Repository Settings → Branches/rules: protect `main`, require a pull request and passing `validate` check, resolve conversations, block force pushes/deletion, apply to administrators. For a solo-owner repository, zero additional approving reviewers still permits owner-controlled merges after CI; add a second required reviewer when available.
2. Protect `staging` and `production`: require passing `validate`, block force pushes/deletion; allow the existing promotion workflow to fast-forward after validation. Do not require a separate PR on these promotion-only branches unless the workflow is changed accordingly.
3. Settings → Environments → `production`: require owner approval and restrict deployments to protected branches. Keep owner self-approval permitted if there is no second operator. This is an explicit manual release gate, not a second-person review.
4. Verify an unsuccessful check prevents promotion. Confirm required-check names against the repository's actual `validate` job.

No protection settings were changed by the rejected requests. The audit reports remain local/uncommitted because they contain security findings.
