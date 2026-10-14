# Transactional email

The owner confirmed Hostinger Email and an existing `orders@veelad.com` mailbox. Codex cannot access hPanel or the mailbox password. The code and simulated delivery tests are ready; actual SMTP authentication and inbox delivery require the private configuration below. Payments remain disabled.

## Configure staging in hPanel

Open the **staging.veelad.com Node.js app → Environment variables**, add or update these values, save, and redeploy. Keep the existing database, session, upload, and application variables. These are the email fields only:

```dotenv
MAIL_ENABLED=true
MAIL_FROM=orders@veelad.com
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=orders@veelad.com
SMTP_PASSWORD=ENTER_THE_MAILBOX_PASSWORD_PRIVATELY
MAIL_TEST_RECIPIENT=ENTER_AN_INBOX_YOU_CONTROL
MAIL_WORKER_INTERVAL_SECONDS=60
```

`SMTP_PASSWORD` is the password of the `orders@veelad.com` email mailbox, not the database password, SSH password, or hPanel login. Confirm the outgoing server in **Emails → Manage orders@veelad.com → Connect apps/devices / configuration settings**. The Hostinger Email SMTP server is normally `smtp.hostinger.com` on SSL/TLS port 465; port 587 with required STARTTLS is also supported by the app. This recipe is for Hostinger Email, not Titan. Mailbox credentials belong in hPanel runtime secrets; never commit real `.env` files.

Staging requires one valid `MAIL_TEST_RECIPIENT`. Use the owner-controlled inbox agreed for the test. It is displayed only to administrators; it is not returned in public bootstrap. The worker never redirects messages or password reset links from other accounts to this inbox. Other recipients are held, and recovery for a non-test account responds generically without creating a token. Staging subjects begin with `[STAGING]`.

## Verify without SSH

1. After redeployment, sign in as administrator and open **System**. Email configuration must show no missing settings, and both test buttons must be enabled. If an old `MAIL_WORKER_INTERVAL_SECONDS=0` is present, change it to 60.
2. Click **Check SMTP connection**. This checks the connection and authentication, and does not send mail. `EAUTH` means the mailbox login was rejected; check that the email account password and full mailbox username are correct. `ETIMEDOUT`, `ECONNECTION`, `ESOCKET`, or `EDNS` indicate network/TLS/provider troubleshooting. API responses contain only safe error codes.
3. Confirm that the test recipient is your inbox, tick the confirmation checkbox, and click **Send test email**. Check both inbox and spam. SMTP acceptance alone does not prove inbox delivery. The test goes directly to that explicit address and never drains queued messages. Checks are administrator-only, protected by CSRF, and limited to five requests per IP every 15 minutes.
4. Use a staging buyer account with the allowlisted email address to request password recovery. Receive the email and reset once; a reused link must fail. Links expire after one hour, and requesting a replacement prevents the previous queued link from being sent. No raw recovery token is returned by the API.
5. Place a fictional order with that address. Wait up to the configured worker interval, plus SMTP processing time. Confirm the receipt’s line items, totals, private tracking link, and “no charge” wording. Retrying the same checkout must not produce another receipt.
6. For the artist test, use a separate owner-controlled artist inbox: change `MAIL_TEST_RECIPIENT` privately and redeploy, then submit artwork, approve it from the administrator dashboard, and confirm the submission/approval messages. Never forward a buyer’s recovery link to an artist inbox. Repeat saves with unchanged approval status do not send another approval update.

Do not rely on password recovery until these checks succeed. Newsletter subscriptions remain records in the administrator inbox; this change does not send marketing campaigns.

## Queue, migrations, and rollback

`002-mail-delivery.json` adds `mail_delivery` metadata without changing the original PHP-compatible `mail_queue` columns or migration 001. Staging applies this additive migration after opening HTTP. Production requires its own reviewed `npm run migrate` release step. Back up the database before deployment. Existing users, orders, products, and queue records are preserved.

New records are inserted with their delivery metadata in the same transaction as the triggering action. Delivery statuses:

| Status | Meaning |
| --- | --- |
| queued | Delivery was configured and the recipient permitted when this event occurred. |
| held | Disabled/incomplete email settings, an unapproved staging recipient, or a historical queue entry without delivery metadata. Never auto-released. |
| sending | An attempt is in progress, or acceptance is uncertain after interruption. Review provider logs before taking any action. |
| sent | SMTP server accepted the recipient. Inbox delivery still depends on the provider. |
| failed | Five attempts exhausted or recipient rejected. Diagnose the provider issue before a reviewed retry. |
| expired | Recovery token expired, was consumed, or was replaced. Private body is removed. |

Worker retries wait 60, 120, 240, then 480 seconds between attempts. The worker uses a MySQL advisory lock so simultaneous processes cannot normally send the same queued record. Connection loss during SMTP DATA or a database failure after SMTP acceptance leaves `sending`; it never automatically requeues an ambiguously delivered message. Never blanket-reset `held`, `failed`, or `sending` entries to `queued`. Request fresh recovery links rather than releasing old ones. System displays aggregate counts without exposing message bodies, SMTP passwords, or tokens.

For rollback, first set `MAIL_ENABLED=false` and redeploy to stop delivery. Revert the application to the previous approved revision while leaving the additive metadata table intact; do not drop the table or remove migration history. If rolling back to a release predating the metadata guard, keep email disabled: its older worker must not process historical mail. Preserve provider logs and inspect any `sending` entries before re-enabling. Orders/customer data are not deleted.

## Separate production release

Production requires its own SMTP secret and approved sender configuration, reviewed SPF/DKIM/DMARC records shown by the email provider, and an explicitly approved launch. Do not reuse staging’s environment file or enable production mail as part of a staging deployment. `MAIL_TEST_RECIPIENT` only restricts staging; in production, enabling email permits delivery to actual transaction recipients. Test with a deliberate controlled production transaction before relying on mail. No production release or real payments are part of this change.

## Validation

`npm test` exercises real MySQL transactions with a simulated SMTP transport: disabled/legacy hold, staging recipient protection, reset expiry/replacement, bounded retries, concurrency, uncertain acceptance, deduplicated order/artist updates, and administrator authorization. `npm run test:ui` checks configuration messages, disabled recovery, connection/test controls, explicit recipient consent, and results at desktop/mobile sizes. These automated tests send no external email. A healthy website and passing tests do not verify actual mailbox delivery.
