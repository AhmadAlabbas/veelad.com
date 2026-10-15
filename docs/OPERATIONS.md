# Storage, backups, restore, and monitoring

## Private artwork and redeployment continuity

The Node service checks that `UPLOAD_DIR` is writable and, in staging/production, outside public document roots and the application checkout. It checks every recorded artwork path for missing files. A private marker in that directory is compared with the database across revisions. `not_yet_observed` means one revision was checked; `observed_across_releases` means the same marker survived a later revision; `lost` or missing files requires investigation. The status is visible in Admin → System and a limited readiness summary. No filesystem paths or keys are public.

Two successful revision checks prove observed continuity for those deployments. They do not establish Hostinger's contractual retention/disaster recovery guarantees. Confirm the account's persistent private storage policy with Hostinger. The earlier reported account directory `/home/u260732541/private-artwork/` is suitable only if the Node runtime's real path checks and redeploy observations pass. Do not move artwork into `public_html` or a deployment build folder. A continuity loss remains flagged until the operator reconciles files/database and resets the stored proof deliberately; never erase that warning simply to make a check pass.

## Automatic encrypted backups

Staging defaults to a daily backup inside the Node runtime, with no SSH/Node shell requirement. `BACKUP_ENABLED=false` explicitly disables it. Production defaults to disabled and must be enabled as part of its deliberate release. A separate private directory is derived beside `UPLOAD_DIR` as `veelad-backups-{environment}`, or overridden with `BACKUP_DIR`. Backup directories in public roots/deployment folders or inside the artwork directory are rejected.

Snapshots use AES-256-GCM authenticated encryption. The encryption key is either `BACKUP_ENCRYPTION_KEY` (base64 encoding of 32 random bytes) or an HKDF-derived key from the existing `SESSION_SECRET` environment variable, scoped to the environment. Keys never enter GitHub or backup artifacts. **Download and keep the private recovery key separately before rotating SESSION_SECRET or changing backup keys. Old backups require the key that created them.** Admin → System provides audited, administrator-only downloads of the encrypted snapshot and recovery key. Keep the key in a password manager/private offline store, separate from the backup. Do not send it in chat.

The worker uses a MySQL advisory lock and a repeatable-read consistent snapshot. It includes users, artist profiles, products, orders, artwork associations and original bytes, reviews, messages, mail metadata, and migration manifest. It writes the encrypted artifact with mode 0600 and verifies that artifact can be decrypted/authenticated before reporting success. Failed partial writes are removed. Backups retain private tokens/hashes only inside ciphertext. The current implementation caps artwork at 100 MiB and total JSON at 150 MiB to bound memory use; exceeding the cap fails visibly rather than creating an incomplete snapshot. It does not delete old backup files automatically; monitor disk use and establish a reviewed retention policy.

The service checks its due time every minute while running and on startup. Hostinger may suspend an idle managed process; the external monitoring requests also wake it, but exact execution times are not guaranteed. The initial backup on deployment plus hourly/daily checks can be reviewed in Admin → System. Manual **Create encrypted backup** also runs the same locked implementation.

Same-account backup files are **not an off-server disaster-recovery copy**. Download encrypted backups to a separate protected location or configure Hostinger's managed backups/private object storage with verified retention. Codex cannot assert those account features are configured without account access. Keep staging and production artifacts/keys separate. No files are uploaded to public GitHub artifacts.

Optional private variables:

```dotenv
BACKUP_ENABLED=true
BACKUP_DIR=/home/u260732541/veelad-backups-staging
BACKUP_ENCRYPTION_KEY=BASE64_32_BYTE_PRIVATE_KEY
BACKUP_INTERVAL_HOURS=24
```

Defaults already work from the existing private staging environment when storage is suitable; do not paste the placeholder key above. A dedicated key is recommended for long-term operation so session rotations don't affect backup recovery.

## Restore verification

The restore tool decrypts only an authenticated snapshot, restores into a **fresh** database ending `_test` or `_restore`, and writes artwork into an empty private folder. It only runs in local/test mode, refuses existing target databases, uses validated schema columns rather than executing uploaded SQL, and never overwrites the live database or artwork. Supply the original snapshot key privately in BACKUP_ENCRYPTION_KEY.

```sh
# Local isolated recovery rehearsal, with private .env configuration.
npm run backup:restore -- --file /private/veelad-staging-example.vbackup --target veelad_recovery_test --uploads /private/recovery-artwork
```

Check restored account/product/order counts and artwork bytes before planning a cutover. A failed rehearsal leaves its new target for investigation; remove only that disposable target. The local automated test creates, encrypts, decrypts, restores, and compares a fixture's database record and original image bytes. This validates the implementation; it is not a live Hostinger disaster-recovery rehearsal. Download an actual staging artifact/key for that separate rehearsal.

## Availability alerts

`.github/workflows/monitor.yml` checks staging HTTP/database readiness, failed storage checks, and failed/overdue backups; it checks the production homepage without enabling production APIs. It retries three times, allowing transient startup/migration delays. The schedule is every 15 minutes on the default branch, plus manual runs. GitHub may delay scheduled runs; this is not a guaranteed real-time paging service.

A failure opens one deduplicated repository issue named `[Operations] Website, database, or storage needs attention` and fails the workflow. Recovery closes it. Issue bodies contain only status/run links. Enable notifications for repository issues and failed workflows in your GitHub account and verify the alert channel reaches you; notification delivery is an account setting Codex cannot confirm. No SMTP activation is needed for these GitHub alerts. Monitoring is read-only against both websites and never touches orders or payments.

## Rollback

Before application rollback, take/download an encrypted snapshot and its separate key. Keep the added operational/review tables and migration history. Disable BACKUP_ENABLED for a rollout if diagnosing backup/storage errors, and use the GitHub monitor and provider logs to check recovery. An application revert does not require dropping tables. For data recovery, restore database and artwork together into an isolated target, validate and reconcile orders created after the snapshot, then deliberately switch the matched application/environment. Never silently replace live paid orders.

## Missing originals during migration

If stored uploads are missing, the staging checker looks for the exact database filename in retained staging PHP/upload and Node build directories, validates its image format/dimensions, and copies it into private storage without overwriting a file or changing ownership. It never searches production or assigns unmapped ZIP artwork to guessed accounts. If no original is recoverable, Admin → System lists the missing filenames and offers **Restore missing original**: choose the matching database record, upload its actual original image, and confirm the association. The original bytes, existing upload ID and artist ownership are retained. Existing files cannot be overwritten through this action. Backups preserve the database and available files even while originals are missing, with status `partial` and an encrypted `missing_artwork` manifest. Missing records are never silently deleted or replaced with sample artwork. Monitoring continues to alert, and a partial snapshot is never reported as a complete recovery copy. The checker also searches the five latest authenticated staging snapshots for exact matching IDs/filenames; snapshots from other environments are not used.

## Live staging observations — October 14, 2026

Revisions f4534a7 and ea728dd served normal product/artist URLs and sharing metadata successfully. The private directory marker survived the second revision (`observed_across_releases`). The live check found two missing recorded original files; the retained staging-folder scan did not recover them, so a complete encrypted snapshot correctly remains failed. Use the authenticated administrator recovery form to supply the matching originals, then verify the next snapshot succeeds. A real monitoring run detected this condition and opened operations issue #1. No production release, real payment, SMTP delivery, off-server backup, or Hostinger retention guarantee was asserted.

## Incomplete snapshots and isolated recovery

If a recorded file cannot be found, scheduled backup now writes a `partial` encrypted snapshot instead of losing protection for the entire database and newer artwork. Admin → System labels it incomplete and permits downloading it; CLI backup still exits nonzero and monitoring still fails until the missing originals are recovered. Storage continuity observations do not become a retention guarantee. Permission errors, invalid filenames and capacity limits still fail visibly. Off-server copies still require downloading to separate protected storage or configuring a verified provider.

Normal restore refuses incomplete snapshots **before creating a target database**. If you deliberately need to recover available data while sourcing the missing files separately, the current restore tool accepts `--allow-missing` only with the existing local/test and fresh `_test`/`_restore` safeguards. It reports `complete:false` and `missing_files`; do not switch live traffic to an incomplete recovery. It never overwrites live data.

```sh
npm run backup:restore -- --file /private/incomplete.vbackup --target veelad_partial_restore --uploads /private/partial-artwork --allow-missing
```

Local regression coverage creates complete and incomplete encrypted snapshots, tests authentication failure with a wrong key, restores complete records and artwork into a fresh database, refuses normal partial restore, and tests explicitly isolated partial recovery. Live Hostinger originals cannot be recreated from code; account-only backups or matching originals are still needed if the retained staging sources and authenticated snapshots contain no copy.

Google identities are included in new encrypted snapshots alongside their user records. Temporary OAuth state, authorization codes and provider tokens are not backup data. Older snapshots without an identity table restore an empty identity list. Preserve the identity mapping when restoring Google-only accounts.
