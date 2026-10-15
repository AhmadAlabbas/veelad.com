# Self-hosted font assets

Arabic fonts derive from IBM Plex Sans Arabic, copyright IBM Corp., licensed under the SIL Open Font License 1.1. The original license and copyright notice are retained in OFL-IBM-Plex-Sans-Arabic.txt. Latin fonts derive from DM Sans and Manrope, with their licenses retained alongside the font assets.

Sources: Google Fonts stylesheets at fonts.googleapis.com and font binaries at fonts.gstatic.com. No files come from Thmanyah.

The fonts were subset to the Latin, Arabic, Arabic presentation-form and common punctuation ranges used by the site, retaining shaping/layout tables, and converted to WOFF2. The modified Arabic family and PostScript names are **Veelad Arabic / VeeladArabic** to respect the reserved name "Plex". Arabic font filenames use veelad-arabic. Glyph outlines are unchanged. CSS references the renamed family with Tahoma/sans-serif fallbacks.

The original Google Fonts stylesheet identifiers were IBM Plex Sans Arabic v15, DM Sans v17 and Manrope v20. Font-display is swap; no runtime requests to Google Fonts are required.

The customer text editor additionally bundles sfnt/TrueType versions of Veelad Arabic Regular/Bold, DM Sans Regular and Manrope Regular, decoded from the existing WOFF2 files with fontTools. Their glyphs and shaping tables are unchanged. Server-side Pango uses these files for both preview glyphs and composed artwork exports; no system-font substitution or external font service is intended. Arabic strings selected with a Latin family use the bundled Veelad Arabic companion.
