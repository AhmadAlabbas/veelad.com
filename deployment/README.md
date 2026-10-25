# Production upgrade via phpMyAdmin

Prepared for release `0529958dbd0fe77ae637788389410971e5ca7942` when Hostinger exposes an entry file but no custom build command.

1. Export a private backup of the production database and retain the private artwork backup and recovery key.
2. In phpMyAdmin select **u260732541_veeladprod**.
3. Import **production-upgrade-008-015.sql**. Do not import a staging database or sample-data export.
4. Confirm the result is **UPGRADE_COMPLETE**, with no SQL errors. If it reports **UPGRADE_NOT_APPLIED** or an error, stop and share the message without credentials.
5. Confirm migration history contains 001–015 before promoting application code. Leave the Node entry file as **src/server.js**.

This file runs the existing migration statements and records their exact SHA-256 checksums. It uses the application's migration lock and requires the exact target database and unchanged baseline migrations 001–007. Completed migrations are skipped, including their data-baseline statements. An interrupted import can leave additive tables behind; rerunning can complete missing migration records. MySQL DDL is not transactional. Stop on any SQL error rather than continuing manually.

The upgrade adds tables and records a baseline for existing published products. It does not delete existing data, import designs, enable payments, activate Partners, change credentials, or modify store settings.

The export was exercised against an isolated MySQL database: successful 008–015 upgrade, unchanged existing account data, repeat-import behavior, wrong-database rejection, and checksum-mismatch rejection all passed. This is local validation, not a claim that production has been upgraded.

Regenerate with `node scripts/export-production-upgrade.js u260732541_veeladprod deployment/production-upgrade-008-015.sql`.
