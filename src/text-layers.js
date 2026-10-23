import sharp from "sharp";
import fs from "node:fs/promises";
import { fail } from "./security.js";

import {designFonts,fontPath,legacyFontForText,supportsText} from './font-library.js';
export {designFonts} from './font-library.js';
const types = ["shirt", "tote", "mug", "notebook", "phone", "print", "sticker"];
export function validateTextLayers(value = {}, options = {}) {
  const scene=options.scene===true;
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !types.includes(key))
  )
    fail(422, "Please check the text layers.");
  const result = {};
  for (const [type, layers] of Object.entries(value)) {
    if (!Array.isArray(layers) || layers.length > (scene?24:4))
      fail(422, scene?"Add up to 24 layers per print surface.":"Add up to four text layers per product.");
    result[type] = layers.map((layer, index) => {
      if (
        !layer ||
        typeof layer !== "object" ||
        typeof layer.text !== "string" ||
        [...layer.text].length > (scene?500:120) ||
        layer.text.split("\n").length > (scene?12:4) ||
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
        ["size", scene?0.005:0.02, scene?0.5:0.2],
        ["rotation", -180, 180],
      ])
        if (
          !Number.isFinite(layer[key]) ||
          layer[key] < min ||
          layer[key] > max
        )
          fail(422, "Please check the text layers.");
      if(scene&&!supportsText(legacyFontForText(layer)?.id||layer.font,layer.text))fail(422,"This font does not include every character in your text. Choose a font for that language.");
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
export const validateSceneTextLayers=layers=>validateTextLayers({shirt:layers},{scene:true}).shirt;
export const effectiveFont=layer=>legacyFontForText(layer);
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
async function prepareTextGlyph(layer, width = 900) {
  if (!layer.text.trim()) return null;
  const font = effectiveFont(layer),
    fontfile = fontPath(font.id||Object.keys(designFonts).find(id=>designFonts[id]===font));
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
  const fontSize=Math.max(1,Math.round(width*layer.size));
  const glyphInput=size=>({
    text: {
      text: `<span foreground="${layer.color}">${escape(direction + layer.text)}</span>`,
      font: font.family + " " + size,
      fontfile,
      align: layer.align,
      rgba: true,
      wrap: "none",
      spacing: Math.round(size * 0.2),
    },
  });
  // Measure large lettering at a small, fixed type size first. Font shaping
  // remains exact, while a 500-character line cannot allocate an enormous native
  // bitmap merely to discover that it exceeds the print-rendering limits.
  if(fontSize>64){
    const reference=await sharp(glyphInput(64)).metadata(),ratio=fontSize/64;
    const longest=Math.max(...layer.text.split('\n').map(line=>[...line].length));
    const estimatedWidth=Math.ceil(reference.width*ratio)+longest*2;
    const estimatedHeight=Math.ceil(reference.height*ratio)+layer.text.split('\n').length*2;
    if(estimatedWidth>16000||estimatedHeight>16000||estimatedWidth*estimatedHeight>24000000)
      fail(422,"Text is too large. Reduce the font size or add line breaks.");
  }
  const input=glyphInput(fontSize);
  const info = await sharp(input).metadata();
  if (
    info.width * info.height > 24000000 ||
    info.width > 16000 ||
    info.height > 16000
  )
    fail(422, "Text is too large. Reduce the font size or add line breaks.");
  return {input,info};
}
export async function textGlyphMetadata(layer,width=900){return (await prepareTextGlyph(layer,width))?.info||null;}
export async function renderTextGlyph(layer,width=900){const prepared=await prepareTextGlyph(layer,width);return prepared?sharp(prepared.input).png().toBuffer():null;}
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
