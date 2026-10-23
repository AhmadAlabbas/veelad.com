#!/usr/bin/env python3
"""Reproduce the licensed, self-hosted design-font catalogue.

Requires Python 3, fontTools and curl. Font bytes are copied unchanged from a
pinned google/fonts revision. This never subsets, renames or instantiates them.
Run from the repository root: python3 tools/prepare-design-fonts.py
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote
import hashlib
import json
import re
import subprocess
import unicodedata

from fontTools.ttLib import TTFont
from fontTools.unicodedata import script

ROOT = Path(__file__).resolve().parents[1]
REVISION = "45e3d5269e4a17d823f6d84470bc084dc5ae46f6"
BASE = f"https://raw.githubusercontent.com/google/fonts/{REVISION}/"
OUT = ROOT / "public/assets/fonts/library"
CACHE = ROOT.parent / "scratch/font-library-sources" / REVISION

# Categories are intentionally useful to a design picker, rather than promises
# that a family supports every character in its named language/script.
ARABIC = """Cairo|Tajawal|Almarai|Changa|El Messiri|Amiri|Aref Ruqaa|Reem Kufi|Reem Kufi Fun|Markazi Text|Lateef|Scheherazade New|Noto Naskh Arabic|Noto Sans Arabic|Noto Kufi Arabic|Readex Pro|Mada|Harmattan|Mirza|Katibeh|Lalezar|Rakkas|Kufam|Vazirmatn|Gulzar|Noto Nastaliq Urdu|Alexandria""".split("|")
LATIN = {
    "sans": "Inter|Montserrat|Poppins|Lato|Nunito|Nunito Sans|Work Sans|Raleway|Oswald|Archivo|Barlow|Barlow Condensed|Space Grotesk|IBM Plex Sans|Source Sans 3|Josefin Sans|Quicksand|Comfortaa|Lexend|Syne|Unbounded",
    "serif": "IBM Plex Serif|Source Serif 4|Merriweather|Lora|Playfair Display|Cormorant Garamond|Libre Baskerville|Crimson Pro|EB Garamond|Bodoni Moda|DM Serif Display|Fraunces|Prata|Cinzel",
    "display": "Archivo Black|Bebas Neue|Anton|Abril Fatface|Cinzel Decorative|Lobster|Bungee|Fredoka|Baloo 2|Luckiest Guy|Lilita One|Righteous|Audiowide|Orbitron|Press Start 2P|Russo One|Creepster",
    "handwriting": "Pacifico|Caveat|Dancing Script|Great Vibes|Sacramento|Satisfy|Allura|Courgette|Permanent Marker|Patrick Hand|Kalam|Indie Flower|Shadows Into Light|Gloria Hallelujah|Architects Daughter",
    "mono": "Space Mono|IBM Plex Mono|Special Elite|Courier Prime",
}
NOTO = """Sans|Serif|Sans Hebrew|Serif Hebrew|Sans Devanagari|Sans Bengali|Sans Gurmukhi|Sans Gujarati|Sans Oriya|Sans Tamil|Sans Telugu|Sans Kannada|Sans Malayalam|Sans Sinhala|Sans Thai|Sans Lao|Sans Khmer|Sans Myanmar|Sans Armenian|Sans Georgian|Sans Ethiopic|Sans Cherokee|Sans Canadian Aboriginal|Sans Tifinagh|Sans Vai|Sans Bamum|Sans Adlam|Sans NKo|Sans Ol Chiki|Sans Saurashtra|Sans Balinese|Sans Sundanese|Sans Javanese|Sans Tai Tham|Sans Tai Viet|Serif Tibetan|Sans Syriac|Sans Thaana|Sans Mongolian|Sans Lepcha|Sans Meetei Mayek|Sans Newa|Sans Chakma|Sans Osmanya|Sans Osage|Sans Lisu""".split("|")
CJK = ["Noto Sans JP", "Noto Sans SC", "Noto Sans TC", "Noto Sans KR"]
SAMPLES = {
    "Arab": "أهلاً بالإبداع — صمّم بأسلوبك", "Hebr": "שלום עולם", "Deva": "नमस्ते दुनिया",
    "Beng": "নমস্কার পৃথিবী", "Guru": "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ", "Gujr": "નમસ્તે દુનિયા", "Orya": "ନମସ୍କାର",
    "Taml": "வணக்கம் உலகம்", "Telu": "నమస్తే ప్రపంచం", "Knda": "ನಮಸ್ಕಾರ ಜಗತ್ತು", "Mlym": "നമസ്കാരം",
    "Sinh": "ආයුබෝවන්", "Thai": "สวัสดีโลก", "Laoo": "ສະບາຍດີ", "Khmr": "សួស្តី​ពិភពលោក", "Mymr": "မင်္ဂလာပါ",
    "Armn": "Բարեւ աշխարհ", "Geor": "გამარჯობა", "Ethi": "ሰላም", "Cher": "ᎣᏏᏲ", "Cans": "ᐊᐃᓐᖓᐃ",
    "Tfng": "ⴰⵣⵓⵍ", "Vaii": "ꕙꔤ", "Bamu": "ꚠꚡꚢ", "Adlm": "𞤀𞤣𞤤𞤢𞤥", "Nkoo": "ߒߞߏ",
    "Olck": "ᱚᱞ ᱪᱤᱠᱤ", "Saur": "ꢱꣃꢬꢵꢰ꣄ꢜ꣄ꢬ", "Bali": "ᬲ᭄ᬯᬲ᭄ᬢᬶ", "Sund": "ᮞᮥᮔ᮪ᮓ", "Java": "ꦗꦮ",
    "Lana": "ᨲ᩠ᩅᩫᩡᨾᩮᩬᩥᨦ", "Tavt": "ꪼꪕꪒꪾ", "Tibt": "བཀྲ་ཤིས་", "Syrc": "ܫܠܡܐ", "Thaa": "ދިވެހި", "Mong": "ᠮᠣᠩᠭᠣᠯ",
    "Lepc": "ᰛᰩᰵᰛᰧᰶᰶ", "Mtei": "ꯃꯤꯇꯩ", "Newa": "𑐣𑐾𑐥𑐵𑐮", "Cakm": "𑄌𑄋𑄴𑄟𑄳𑄦", "Osma": "𐒆𐒖𐒁𐒘", "Osge": "𐓏𐒰𐓓𐒰𐓓𐒷", "Lisu": "ꓡꓲꓢꓴ",
    "Jpan": "自分らしく、自由に", "Hans": "创造属于你的风格", "Hant": "創造屬於你的風格", "Kore": "나만의 디자인을 만들어요",
}
SCRIPT_NAMES = {
    "Latn": "Latin", "Arab": "Arabic", "Grek": "Greek", "Cyrl": "Cyrillic", "Hebr": "Hebrew",
    "Deva": "Devanagari", "Beng": "Bengali", "Guru": "Gurmukhi", "Gujr": "Gujarati", "Orya": "Odia",
    "Taml": "Tamil", "Telu": "Telugu", "Knda": "Kannada", "Mlym": "Malayalam", "Sinh": "Sinhala",
    "Thai": "Thai", "Laoo": "Lao", "Khmr": "Khmer", "Mymr": "Myanmar", "Armn": "Armenian", "Geor": "Georgian",
    "Ethi": "Ethiopic", "Cher": "Cherokee", "Cans": "Canadian Aboriginal", "Tfng": "Tifinagh", "Vaii": "Vai",
    "Bamu": "Bamum", "Adlm": "Adlam", "Nkoo": "NKo", "Olck": "Ol Chiki", "Saur": "Saurashtra", "Bali": "Balinese",
    "Sund": "Sundanese", "Java": "Javanese", "Lana": "Tai Tham", "Tavt": "Tai Viet", "Tibt": "Tibetan", "Syrc": "Syriac",
    "Thaa": "Thaana", "Mong": "Mongolian", "Lepc": "Lepcha", "Mtei": "Meetei Mayek", "Newa": "Newa", "Cakm": "Chakma",
    "Osma": "Osmanya", "Osge": "Osage", "Lisu": "Lisu", "Hani": "Han", "Hira": "Hiragana", "Kana": "Katakana",
    "Hang": "Hangul", "Jpan": "Japanese", "Hans": "Simplified Chinese", "Hant": "Traditional Chinese", "Kore": "Korean",
    "Copt": "Coptic", "Bopo": "Bopomofo",
}

def fetch(relative, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.is_file():
        partial = destination.with_name(destination.name + ".partial")
        subprocess.run(["curl", "--fail", "--silent", "--show-error", "--location", "--retry", "3", "--max-time", "180", BASE + quote(relative, safe="/"), "-o", str(partial)], check=True)
        partial.replace(destination)
    return destination.read_bytes()

def ranges(points):
    result = []
    for point in sorted(points):
        if result and result[-1][1] + 1 == point:
            result[-1][1] = point
        else:
            result.append([point, point])
    return result

def inspect(data, entry):
    source = ROOT / "public/assets/fonts" / entry["file"]
    font = TTFont(source, lazy=True)
    cmap = font.getBestCmap()
    counts = {}
    for cp in cmap:
        if unicodedata.category(chr(cp)).startswith("L"):
            key = script(chr(cp))
            counts[key] = counts.get(key, 0) + 1
    entry["scripts"] = sorted(key for key, count in counts.items() if key not in ["Zyyy", "Zinh", "Zzzz"] and count >= 3)
    if "primary_script" in entry and entry["primary_script"] not in entry["scripts"]:
        entry["scripts"].append(entry["primary_script"])
        entry["scripts"].sort()
    entry["coverage"] = ranges(cmap)
    entry["bytes"] = len(data)
    entry["sha256"] = hashlib.sha256(data).hexdigest()
    entry["sample"] = SAMPLES.get(entry.get("primary_script"), "Create something wonderful")
    if "primary_script" not in entry and "Arab" in entry["scripts"]:
        entry["sample"] = SAMPLES["Arab"]
    # The family name exposed by Pango, including variable font family names.
    names = font["name"]
    if not entry.get("legacy"):
        entry["family"] = names.getDebugName(16) or names.getDebugName(1)
    font.close()
    return entry

def download(label, category):
    slug = re.sub(r"[^a-z0-9]", "", label.lower())
    directory = ("apache/" if slug in {"luckiestguy", "satisfy", "permanentmarker", "specialelite"} else "ofl/") + slug
    meta = fetch(directory + "/METADATA.pb", CACHE / slug / "METADATA.pb").decode()
    blocks = re.findall(r"fonts\s*\{(.*?)\n\}", meta, re.S)
    choices = []
    for block in blocks:
        filename = re.search(r'filename: "([^"]+)"', block).group(1)
        style = re.search(r'style: "([^"]+)"', block).group(1)
        weight = int(re.search(r'weight: (\d+)', block).group(1))
        choices.append((style != "normal", abs(weight - 400), filename, weight))
    _, _, filename, weight = sorted(choices)[0]
    data = fetch(directory + "/" + filename, CACHE / slug / filename)
    apache = 'license: "APACHE2"' in meta
    license_filename = "LICENSE.txt" if apache else "OFL.txt"
    license_data = fetch(directory + "/" + license_filename, CACHE / slug / license_filename)
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / (slug + ".ttf")
    target.write_bytes(data)
    target_license = slug + (".LICENSE.txt" if apache else ".OFL.txt")
    (OUT / target_license).write_bytes(license_data)
    primary = re.search(r'primary_script: "([^"]+)"', meta)
    primary = primary.group(1) if primary else None
    if label in CJK:
        primary = {"Noto Sans JP": "Jpan", "Noto Sans SC": "Hans", "Noto Sans TC": "Hant", "Noto Sans KR": "Kore"}[label]
    entry = {"id": re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-"), "label": label, "family": label,
             "file": "library/" + target.name, "category": category, "weight": weight, "license": "Apache-2.0" if apache else "OFL-1.1",
             "license_file": "library/" + target_license, "source": BASE + quote(directory + "/" + filename, safe="/")}
    copyright_match = re.search(r'copyright: "([^"]+)"', meta)
    if copyright_match:
        entry["copyright"] = copyright_match.group(1)
    if primary:
        entry["primary_script"] = primary
    return inspect(data, entry)

def main():
    specs = [(name, "arabic") for name in ARABIC]
    specs += [(name, category) for category, names in LATIN.items() for name in names.split("|")]
    specs += [("Noto " + name, "serif" if name.startswith("Serif") else "sans") for name in NOTO]
    specs += [(name, "sans") for name in CJK]
    entries = []
    errors = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(download, name, category): name for name, category in specs}
        for future in as_completed(futures):
            name = futures[future]
            try:
                entries.append(future.result())
            except Exception as exc:
                errors.append(f"{name}: {exc}")
                print(f"FAILED {name}: {exc}", flush=True)
    if errors:
        raise SystemExit("Resolve download errors before writing catalogue.\n" + "\n".join(errors))
    legacy = [
        ("arabic", "Veelad Arabic", "veelad-arabic-400.ttf", "arabic", "OFL-IBM-Plex-Sans-Arabic.txt", 400),
        ("arabic-bold", "Veelad Arabic Bold", "veelad-arabic-700.ttf", "arabic", "OFL-IBM-Plex-Sans-Arabic.txt", 700),
        ("manrope", "Manrope", "manrope-400.ttf", "sans", "OFL-Manrope.txt", 400),
        ("dm-sans", "DM Sans", "dm-sans-400.ttf", "sans", "OFL-DM-Sans.txt", 400),
    ]
    for id_, family, filename, category, license_file, weight in legacy:
        entry = {"id": id_, "label": family, "family": family, "file": filename, "category": category, "weight": weight,
                 "license": "OFL-1.1", "license_file": license_file, "legacy": True}
        entries.append(inspect((ROOT / "public/assets/fonts" / filename).read_bytes(), entry))
    entries.sort(key=lambda entry: (not entry.get("legacy", False), entry["label"].casefold()))
    catalogue = {"version": 1, "source_revision": REVISION, "script_names": SCRIPT_NAMES, "fonts": entries}
    (ROOT / "public/assets/design-fonts.json").write_text(json.dumps(catalogue, ensure_ascii=False, separators=(",", ":")) + "\n")
    readme = f"""# Veelad design font library

{len(entries)} font choices are self-hosted for the design studio. The four legacy
font IDs remain unchanged so saved designs keep their appearance. Every new TTF
is an **unchanged original**, retrieved from google/fonts at commit
`{REVISION}`. Each `.OFL.txt` or `.LICENSE.txt` contains the complete SIL Open
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
"""
    (OUT / "README.md").write_text(readme)
    print(json.dumps({"fonts": len(entries), "font_bytes": sum(e["bytes"] for e in entries), "scripts": len(set(s for e in entries for s in e["scripts"]))}))

if __name__ == "__main__":
    main()
