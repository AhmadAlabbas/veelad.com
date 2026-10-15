import sharp from "sharp";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { fail } from "./security.js";

export const designFonts = {
  arabic: { family: "Veelad Arabic", file: "veelad-arabic-400.ttf" },
  "arabic-bold": {
    family: "Veelad Arabic Bold",
    file: "veelad-arabic-700.ttf",
  },
  manrope: { family: "Manrope", file: "manrope-400.ttf" },
  "dm-sans": { family: "DM Sans", file: "dm-sans-400.ttf" },
};
const types = ["shirt", "tote", "mug", "notebook", "phone", "print", "sticker"];
export function validateTextLayers(value = {}) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !types.includes(key))
  )
    fail(422, "Please check the text layers.");
  const result = {};
  for (const [type, layers] of Object.entries(value)) {
    if (!Array.isArray(layers) || layers.length > 4)
      fail(422, "Add up to four text layers per product.");
    result[type] = layers.map((layer, index) => {
      if (
        !layer ||
        typeof layer !== "object" ||
        typeof layer.text !== "string" ||
        [...layer.text].length > 120 ||
        layer.text.split("\n").length > 4 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(
          layer.text,
        ) ||
        typeof layer.font !== "string" ||
        !Object.hasOwn(designFonts, layer.font) ||
        typeof layer.color !== "string" ||
        !/^#[0-9a-f]{6}$/i.test(layer.color) ||
        !["left", "center", "right"].includes(layer.align) ||
        !["auto", "rtl", "ltr"].includes(layer.direction)
      )
        fail(422, "Please check the text layers.");
      for (const [key, min, max] of [
        ["x", 0, 1],
        ["y", 0, 1],
        ["size", 0.02, 0.2],
        ["rotation", -180, 180],
      ])
        if (
          !Number.isFinite(layer[key]) ||
          layer[key] < min ||
          layer[key] > max
        )
          fail(422, "Please check the text layers.");
      const id =
        typeof layer.id === "string" && /^[a-zA-Z0-9_-]{1,48}$/.test(layer.id)
          ? layer.id
          : "text-" + index;
      return {
        id,
        text: layer.text.normalize("NFC"),
        font: layer.font,
        color: layer.color.toLowerCase(),
        align: layer.align,
        direction: layer.direction,
        x: layer.x,
        y: layer.y,
        size: layer.size,
        rotation: layer.rotation,
      };
    });
    if (new Set(result[type].map((layer) => layer.id)).size !== layers.length)
      fail(422, "Please check the text layers.");
  }
  return result;
}
export const hasText = (studio, type) =>
  !!studio?.text_layers?.[type]?.some((layer) => layer.text.trim());
const escape = (value) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
export function effectiveFont(layer) {
  return /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u.test(layer.text) &&
    ["manrope", "dm-sans"].includes(layer.font)
    ? designFonts.arabic
    : designFonts[layer.font];
}
export async function croppedOverlay(bytes, left, top, width, height) {
  const info = await sharp(bytes).metadata(),
    x = Math.max(0, -left),
    y = Math.max(0, -top),
    w = Math.min(info.width - x, width - Math.max(0, left)),
    h = Math.min(info.height - y, height - Math.max(0, top));
  if (w <= 0 || h <= 0) return null;
  return {
    input: await sharp(bytes)
      .extract({ left: x, top: y, width: w, height: h })
      .toBuffer(),
    left: Math.max(0, left),
    top: Math.max(0, top),
  };
}
export async function renderTextGlyph(layer, width = 900) {
  if (!layer.text.trim()) return null;
  const font = effectiveFont(layer),
    fontfile = fileURLToPath(
      new URL("../public/assets/fonts/" + font.file, import.meta.url),
    );
  try {
    await fs.access(fontfile);
  } catch {
    fail(503, "Text fonts unavailable. Contact the store team.");
  }
  const direction =
    layer.direction === "rtl"
      ? "\u200f"
      : layer.direction === "ltr"
        ? "\u200e"
        : "";
  const input = {
    text: {
      text: `<span foreground="${layer.color}">${escape(direction + layer.text)}</span>`,
      font: font.family + " " + Math.round(width * layer.size),
      fontfile,
      align: layer.align,
      rgba: true,
      wrap: "none",
      spacing: Math.round(width * layer.size * 0.2),
    },
  };
  const info = await sharp(input).metadata();
  if (
    info.width * info.height > 24000000 ||
    info.width > 16000 ||
    info.height > 16000
  )
    fail(422, "Text is too large. Reduce the font size or add line breaks.");
  return sharp(input).png().toBuffer();
}
export async function renderTextOverlay(product, layers, width = 900) {
  const height = Math.round((width * product.preview[1]) / product.preview[0]),
    overlays = [];
  for (const layer of layers || []) {
    const glyph = await renderTextGlyph(layer, width);
    if (!glyph) continue;
    const bytes = await sharp(glyph)
        .rotate(layer.rotation, { background: "#00000000" })
        .png()
        .toBuffer(),
      rotated = await sharp(bytes).metadata();
    const overlay = await croppedOverlay(
      bytes,
      Math.round(layer.x * width - rotated.width / 2),
      Math.round(layer.y * height - rotated.height / 2),
      width,
      height,
    );
    if (overlay) overlays.push(overlay);
  }
  return sharp({
    create: { width, height, channels: 4, background: "#00000000" },
  })
    .composite(overlays)
    .png()
    .toBuffer();
}
