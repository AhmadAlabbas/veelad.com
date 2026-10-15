# Google sign-up and sign-in

Google sign-in is implemented but stays hidden until you configure a Google OAuth **Web application** client. It does not depend on Hostinger Email or SMTP. Email/password login stays available. New Google users choose customer or artist; Google cannot create an administrator. Existing connected users keep their current role, products, designs and orders.

## Configure staging

1. Open [Google Cloud Console](https://console.cloud.google.com/) using the Google account that should own Veelad's configuration. Create or select a project for Veelad.
2. Open **Google Auth Platform** and complete **Branding**, **Audience** and **Data Access** (older Console layouts call this the OAuth consent screen). Use the Veelad name, a support email you control, and your real site/policy details. Add `veelad.com` as an authorized domain if requested. Request only **openid**, **email**, and **profile**. No Gmail, Drive or Calendar access is needed.
3. Start with **External → Testing** and add the Google accounts that will test staging under **Test users**. While the Google app is in testing mode, users outside this list may be unable to sign in. Console publishing/verification requirements depend on the app configuration; complete any requirements shown there before a public launch.
4. Open **Clients → Create client → Web application** (or **APIs & Services → Credentials → Create credentials → OAuth client ID**). Name it `Veelad staging`. Add this exact **Authorized redirect URI**, with no trailing slash:

   ```text
   https://staging.veelad.com/auth/google/callback
   ```

   This is a server-side authorization-code flow. No JavaScript SDK or additional authorized JavaScript origin is required by this implementation. Do not use `src/server.js`, a hash route, or `/api.php` as the callback.
5. Copy the generated **Client ID** and **Client secret** into **Hostinger → staging.veelad.com Node.js application → Environment variables**. Keep the secret private, out of chat, GitHub, screenshots and frontend files:

   ```dotenv
   GOOGLE_AUTH_ENABLED=true
   GOOGLE_CLIENT_ID=YOUR_STAGING_CLIENT_ID.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=YOUR_PRIVATE_STAGING_CLIENT_SECRET
   ```

   Replace both example values. These are additional variables; keep the existing database/session/storage configuration. `APP_ORIGIN` remains `https://staging.veelad.com`. The callback is derived from it and does not need a separate variable.
6. Save and redeploy the staging app. **Administrator → System → Google sign-in** shows enabled/configured status and the exact callback URI, without revealing secrets. The **Continue with Google** button appears on both the English and Arabic sign-up/login pages once the settings are complete.
7. Test a new customer, an artist, cancellation, logout/sign-in, and connecting an existing account. Inspect actual orders/drafts/bag and both languages before enabling access for everyone. Staging should be tested with controlled Google accounts and fictional order details.

## Existing accounts

An email match does **not** automatically connect accounts. If you already registered with that email, first sign in with your existing Veelad password. Open **My account → Sign-in methods**, enter the current password, and select **Connect Google**. This connects to the same account instead of making a duplicate or changing its role. A Google identity cannot be attached to two Veelad accounts. A connection does not silently change the account's email address.

A new Google-only user can set an email/password login from **My account → Set a password** after a recent Google sign-in. If more than five minutes have passed, use **Confirm identity with Google**, selecting the same connected Google account, then set the password. Disconnecting Google requires a working local password and password confirmation, preventing accidental lockout. Forgot-password recovery still needs the separate email delivery setup.

Google must return a verified email address for Google authentication. This does not add confirmation links to ordinary email/password registrations; that remains a separate feature.

The guest bag and saved favorites are merged into the Google user's account once after successful sign-in. New customers can return to the designer, design library or checkout; destinations are an explicit internal allowlist. Language selection survives the Google round trip.

## Production remains separate

Create a separate Google Web client and secret for production when you deliberately prepare the production release. Its callback will be:

```text
https://veelad.com/auth/google/callback
```

Do not add production credentials to staging or enable production as part of staging setup. The production marketplace release and real payments remain separate decisions. This task does not publish a production release.

## Security and operational behavior

- `openid-client` performs discovery at the fixed Google issuer, PKCE S256 authorization-code exchange, state/nonce checks, issuer/audience/expiry validation, and explicit ID-token signature verification against Google's keys. TLS verification remains enabled. Only minimal identity scopes are requested; provider access/refresh/ID tokens are discarded rather than stored.
- State is random, tied to the current session and consumed once under a database lock. It expires after ten minutes; concurrent callbacks cannot exchange the same attempt twice. POST initiation requires the existing same-origin/CSRF checks. Signed-in account linking also requires the current password and the same session/account at callback time.
- Session IDs rotate after successful Google authentication or connection. Suspended users stay unavailable. Existing native credentials and roles are not overwritten. Callback errors use allowlisted localized messages, not provider response bodies.
- Migration `006-google-auth.json` creates `auth_identities` and ephemeral `oauth_states`. Staging applies it through the existing startup migrator. Production needs the deliberate `npm run migrate` step before enabling this release; never rewrite earlier migration files.
- Encrypted backups include `auth_identities` alongside users; temporary OAuth states are excluded. Older snapshots without identities normalize to an empty identity list on restore. Keep users/identities together during recovery. The separate known missing-artwork condition is not fixed by OAuth setup.
- Provider discovery/token requests have bounded timeouts and do not delay HTTP startup. If Google is unavailable, ordinary password login continues working. No frontend Google SDK, third-party script permission, mailbox password, or SMTP activation is needed.

## Troubleshooting and rollback

`redirect_uri_mismatch` means the exact staging callback above is absent from the selected Web client's authorized redirects, or credentials belong to a different client. An access/consent restriction usually needs the test user added to the configured Google project or the Console's publication requirements completed. A cancelled/expired request can be restarted from the login page. An email-match message requires native login and explicit connection; do not delete the old account to bypass it.

Do not log callback URLs, authorization codes, cookies, credentials or provider tokens. Do not upload private environment files. Google credentials have not been created or entered by Codex, so local tests do not establish real Google delivery/consent or a working Hostinger-to-Google exchange.

To pause new Google sign-ins, set `GOOGLE_AUTH_ENABLED=false` and redeploy. Password accounts continue working; Google-only users need a local password or configured email recovery to sign in while Google is disabled. For code rollback, retain the new tables, identity records and current backup/restore tooling. An older application cannot offer Google sign-in and may not understand Google-only password markers. Test fallback access before rolling back an environment with real Google users.

## Validation

Focused HTTP tests use a cryptographically signed mock Google provider at the real protocol endpoints, exercising real OpenID validation without contacting personal Google accounts. Browser cases exercise redirects, customer/artist signup, existing-account collision and explicit connection, guest-bag persistence, English/Arabic layouts, password setup and safe disconnect. Test credentials and tokens are fixtures only. Real consent, client configuration and account sign-in must be checked after private credentials are installed.
