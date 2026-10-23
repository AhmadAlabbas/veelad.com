import fs from "node:fs";
import { fileURLToPath } from "node:url";

const manifest = JSON.parse(
  fs.readFileSync(new URL("../public/assets/design-fonts.json", import.meta.url), "utf8"),
);
const freeze = (value) => {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

/** The allowlist used by both saved scenes and the browser font picker. */
export const fontCatalogue = freeze(manifest.fonts);
export const designFonts = Object.freeze(
  Object.fromEntries(fontCatalogue.map((font) => [font.id, font])),
);
export const fontScriptNames = freeze(manifest.script_names);

export function fontPath(id) {
  if (typeof id !== "string" || !Object.hasOwn(designFonts, id))
    throw new TypeError("Unknown design font.");
  return fileURLToPath(new URL("../public/assets/fonts/" + designFonts[id].file, import.meta.url));
}

// Spaces and shaping controls need no visible glyph of their own. A variation
// selector is not a promise of colour-emoji support: its base must still exist.
const isSpacingOrControl = (char) =>
  /[\s\u200b-\u200f\u2066-\u2069\ufe0e\ufe0f]/u.test(char);

function includesCodePoint(coverage, point) {
  let low = 0, high = coverage.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const [start, end] = coverage[middle];
    if (point < start) high = middle - 1;
    else if (point > end) low = middle + 1;
    else return true;
  }
  return false;
}

export function missingGlyphs(id, text) {
  const font = Object.hasOwn(designFonts, id) ? designFonts[id] : null;
  return [...new Set([...String(text).normalize("NFC")].filter((char) =>
    !isSpacingOrControl(char) && (!font || !includesCodePoint(font.coverage, char.codePointAt(0))),
  ))];
}

export function supportsText(id, text) {
  return Object.hasOwn(designFonts, id) && missingGlyphs(id, text).length === 0;
}

/** Preserve historical Arabic fallback without changing new font selections. */
export function legacyFontForText(layer) {
  const id = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u.test(layer.text) &&
    ["manrope", "dm-sans"].includes(layer.font) ? "arabic" : layer.font;
  return Object.hasOwn(designFonts, id) ? designFonts[id] : undefined;
}
