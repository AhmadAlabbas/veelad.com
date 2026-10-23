import sharp from "sharp";
import { patternCenters } from "../public/assets/design-math.js";
import { renderTextGlyph } from "./text-layers.js";
import { fail } from "./security.js";

const maxCanvasPixels = 64000000;

// Rendering accepts private bytes, never client paths or URLs. Resolve one native
// source at a time so a many-image print does not preload every 60 MP original.
async function sourceBytes(sources, id, primaryId, resolveSource) {
  let bytes =
    sources instanceof Map
      ? sources.get(id)
      : id === primaryId && Buffer.isBuffer(sources)
        ? sources
        : null;
  if (!bytes) bytes = await resolveSource?.(id);
  if (!Buffer.isBuffer(bytes) || !bytes.length)
    fail(422, "A design image is unavailable. Upload it again before saving.");
  return bytes;
}

function bounds(width, height, rotation) {
  const angle = (rotation * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * height,
    height: Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * height,
  };
}

async function layerOverlay(sources, layer, cw, ch, options) {
  let bytes, width, height;
  if (layer.type === "image") {
    bytes = await sourceBytes(
      sources,
      layer.upload_id,
      options.primaryId,
      options.resolveSource,
    );
    width = layer.width * cw;
    height = layer.height * ch;
  } else {
    bytes = await renderTextGlyph(layer, cw);
    if (!bytes) return null;
    const info = await sharp(bytes).metadata();
    width = info.width;
    height = info.height;
  }
  // An SVG viewport clips before rasterizing, avoiding an enormous intermediate
  // when an enlarged or rotated image extends beyond the printable surface.
  const box = bounds(width, height, layer.rotation),
    x = layer.x * cw,
    y = layer.y * ch,
    repeat = layer.type === "image" && layer.repeat === true,
    centers = patternCenters(
      { width, height, x, y, bounds: box },
      cw,
      ch,
      repeat,
    );
  if (!centers)
    fail(422, "The pattern is too dense. Increase its size or disable repeating.");
  const left = repeat ? 0 : Math.max(0, Math.floor(x - box.width / 2)),
    top = repeat ? 0 : Math.max(0, Math.floor(y - box.height / 2)),
    right = repeat ? cw : Math.min(cw, Math.ceil(x + box.width / 2)),
    bottom = repeat ? ch : Math.min(ch, Math.ceil(y + box.height / 2));
  if (right <= left || bottom <= top) return null;
  const info = await sharp(bytes, { limitInputPixels: 60000000 }).metadata();
  if (!["png", "jpeg"].includes(info.format))
    fail(422, "Use a PNG or JPEG for design images.");
  const mime = info.format === "jpeg" ? "image/jpeg" : "image/png",
    opacity = Number.isFinite(layer.opacity) ? layer.opacity : 1,
    svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${right - left}" height="${bottom - top}"><defs><image id="art" width="${width}" height="${height}" preserveAspectRatio="none" xlink:href="data:${mime};base64,${bytes.toString("base64")}"/></defs>${centers.map((center) => `<use xlink:href="#art" opacity="${opacity}" transform="translate(${center.x - left} ${center.y - top}) rotate(${layer.rotation}) translate(${-width / 2} ${-height / 2})"/>`).join("")}</svg>`;
  return {
    input: await sharp(Buffer.from(svg), { limitInputPixels: maxCanvasPixels })
      .png()
      .toBuffer(),
    left,
    top,
  };
}

export async function renderSceneTexture(
  sources,
  product,
  scene,
  width = 900,
  options = {},
) {
  const height = Math.round((width * product.preview[1]) / product.preview[0]);
  if (
    !Number.isInteger(width) ||
    width < 1 ||
    height < 1 ||
    width * height > maxCanvasPixels
  )
    fail(422, "The print canvas is too large. Choose a smaller export size.");
  let texture = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background:
        !scene || scene.background === "transparent"
          ? "#00000000"
          : scene.background,
    },
  })
    .png()
    .toBuffer();
  const overlays = [];
  for (const layer of scene?.layers || []) {
    if (layer.visible === false || layer.opacity === 0) continue;
    const overlay = await layerOverlay(sources, layer, width, height, options);
    if (overlay) overlays.push(overlay);
    // Small batches retain order without holding all native source files or
    // re-encoding a large print canvas after every tiny text layer.
    if (overlays.length === 4) {
      texture = await sharp(texture).composite(overlays).png().toBuffer();
      overlays.length = 0;
    }
  }
  if (overlays.length)
    texture = await sharp(texture).composite(overlays).png().toBuffer();
  return texture;
}
