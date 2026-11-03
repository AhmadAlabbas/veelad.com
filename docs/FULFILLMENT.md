# Veelad Fulfillment — Phase 1

The private supplier workspace is at /fulfillment, separate from the affiliate /partners area. This release is for staging tests with fictional orders. FULFILLMENT_ENABLED remains off in production unless explicitly activated.

## Supplier onboarding

A Veelad administrator creates the supplier company and invites an employee using **Suppliers → Secure supplier invitations**. Each invitation is a single-use 48-hour URL, restricted to the exact registered email and a specific supplier role. On staging invitations are **copy-only**, not emailed to third parties, because staging outbound email is restricted. Admins may revoke pending invitations or suspend an existing employee. Employee accounts use normal Veelad authentication, sessions and CSRF protection.

Roles:
- Production operator: accept jobs, start printing, submit evidence and issues, resume corrected jobs, submit shipping references.
- Quality reviewer: review evidence, approve QC, confirm packing, resolve issues.
- Supplier manager: production and quality operations.
- Veelad admin: additionally manage companies, invitations, templates, signed print approvals, dispatch and membership.
Non-admin users cannot review their own inspection photographs. All actions are server-authorized against active supplier memberships.

## Manufacturing specifications and packages

Enter actual factory-confirmed print width/height in millimetres, bleed and minimum effective DPI for each supplier/product category. Print preflight conservatively checks the source against the entire specified area (including bleed), identifies missing files and templates, and lists manual checks for layout, fonts, colour, transparency and physical samples. A Veelad admin must write a manual review note and explicitly approve; automatic validation alone is NOT a factory certification.

The approved report binds the original file SHA-256 checksums, immutable purchased design and current supplier print specifications. Changed source files or templates invalidate the approval and block printing, QC, packing and dispatch. After sign-off, the supplier may export an authenticated ZIP with a JSON production sheet, source originals and available per-surface composited PNG layouts. All layouts are marked provisional pending actual press/sample tests. The regular per-line artwork links remain available for inspection.

## Photo evidence and production issues

During printing, supplier staff upload PNG/JPEG evidence (max 8 MB per photo), associated with the exact order line. Each final-print photo requires approval by a separate quality reviewer/manager or Veelad admin. New final-print photos supersede older approvals. Every order line must have approved final-print evidence before quality check, packing or final dispatch.

Production issues have type, severity, description and a recorded resolution. An issue or photo rejection puts the job on hold; unresolved issues block resuming work. Audit records preserve issue and photo decisions. After packing, the supplier submits tracking; only a Veelad admin may mark the customer order shipped.

## Data protection

All supplier order access is restricted to assigned companies, including original artwork and QC evidence. Artwork and photo uploads are in Veelad's existing private backed-up storage. New Phase 1 records use additive migration zz-20261104-fulfillment-phase1.json and are included in encrypted backups. Suppliers do not see unrelated orders, artist earnings or payment details. Customer shipping address appears only after packing.

## Release and limitations

Staging must have real supplier-confirmed print specs and use fictional payment/order details; production fulfillment must not be enabled without physical testing, a supplier agreement, security/privacy review and confirmed shipping handoffs. Phase 1 does not provide actual Merchlist API integration, automated shipping labels, automatic invitation email in staging, print press certification, MFA, supplier invoicing or splitting one order between suppliers.

Validate with npm run check, npm run build, npm test, local schema migration and full browser tests using an isolated development database. Verify the exact deployed SHA using the staging health endpoint before handing out a live URL.
