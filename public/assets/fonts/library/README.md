# Veelad design font library

152 font choices are self-hosted for the design studio. The four legacy
font IDs remain unchanged so saved designs keep their appearance. Every new TTF
is an **unchanged original**, retrieved from google/fonts at commit
`45e3d5269e4a17d823f6d84470bc084dc5ae46f6`. Each `.OFL.txt` or `.LICENSE.txt` contains the complete SIL Open
Font License or Apache 2.0 license. The catalogue also retains the source
copyright notices; retain all these notices when redistributing the files.

The catalogue records each source URL, SHA-256 digest, file size and actual
Unicode character coverage. Script labels describe available letter glyphs;
they do not imply support for every language, emoji or historic character.
Font files are loaded only when selected/previewed, never all on initial load.
The browser and production renderer use these same files. The server-rendered
text preview remains the authority for shaping and printing.

Reproduce the files with `python3 tools/prepare-design-fonts.py` (requires
`fontTools` and `curl`). This command downloads publicly licensed files; it does
not access application secrets or change production data. No fonts are fetched
from Google or another font provider by website visitors.
