import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  imageLayout,
  patternCenters,
  projectTexture,
} from "../public/assets/design-math.js";
import { printProductFor, mockupId, mockupMatches } from "./design-studio.js";
import { artworkRenderSource } from "./artwork.js";
import { fail } from "./security.js";
import { renderTextOverlay } from "./text-layers.js";
const assets = new URL("../public/assets/mockups/", import.meta.url);
const baseCache = new Map();
const loading = new Map();
async function template(view) {
  if (baseCache.has(view)) return baseCache.get(view);
  const base = await fs.readFile(new URL(view + ".webp", assets)),
    projection = JSON.parse(
      await fs.readFile(new URL(view + ".json", assets), "utf8"),
    );
  const result = { base, projection };
  baseCache.set(view, result);
  return result;
}
export async function renderDesignTexture(preview, category, studio, cw = 900) {
  const product = printProductFor(category),
    placement = studio.placements[product.id],
    info = preview ? await sharp(preview).metadata() : null;
  const ch = Math.round((cw * product.preview[1]) / product.preview[0]),
    layout = info
      ? imageLayout(info.width, info.height, cw, ch, placement)
      : null,
    centers = layout ? patternCenters(layout, cw, ch, placement.repeat) : [];
  if (!centers)
    fail(
      422,
      "The pattern is too dense. Increase its scale or use a single placement.",
    );
  const overlays = [];
  if (preview) {
    const rotated = await sharp(preview)
        .resize(
          Math.max(1, Math.round(layout.width)),
          Math.max(1, Math.round(layout.height)),
          { fit: "fill" },
        )
        .rotate(placement.rotation, { background: "#00000000" })
        .png()
        .toBuffer(),
      rotInfo = await sharp(rotated).metadata();
    for (const center of centers) {
      const left = Math.round(center.x - rotInfo.width / 2),
        top = Math.round(center.y - rotInfo.height / 2),
        x = Math.max(0, -left),
        y = Math.max(0, -top),
        width = Math.min(rotInfo.width - x, cw - Math.max(0, left)),
        height = Math.min(rotInfo.height - y, ch - Math.max(0, top));
      if (width > 0 && height > 0)
        overlays.push({
          input: await sharp(rotated)
            .extract({ left: x, top: y, width, height })
            .toBuffer(),
          left: Math.max(0, left),
          top: Math.max(0, top),
        });
    }
  }
  const texture = await sharp({
    create: {
      width: cw,
      height: ch,
      channels: 4,
      background:
        placement.background === "transparent"
          ? "#00000000"
          : placement.background,
    },
  })
    .composite(overlays)
    .png()
    .toBuffer();
  const text = studio.text_layers?.[product.id];
  return text?.some((layer) => layer.text.trim())
    ? sharp(texture)
        .composite([{ input: await renderTextOverlay(product, text, cw) }])
        .png()
        .toBuffer()
    : texture;
}
export async function renderMockup(preview, category, studio) {
  const product = printProductFor(category),
    placement = studio.placements[product.id],
    cw = 900,
    ch = Math.round((cw * product.preview[1]) / product.preview[0]);
  const texture = await renderDesignTexture(preview, category, studio, cw);
  const { base, projection } = await template(placement.view);
  const raw = await sharp(texture).ensureAlpha().raw().toBuffer(),
    projected = projectTexture(raw, cw, ch, projection);
  let warped = await sharp(projected, {
    raw: { width: projection.width, height: projection.height, channels: 4 },
  })
    .png()
    .toBuffer();
  if (projection.clip_path) {
    const mask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><path fill="white" fill-rule="evenodd" d="${projection.clip_path}"/></svg>`,
    );
    warped = await sharp(warped)
      .composite([{ input: mask, blend: "dest-in" }])
      .png()
      .toBuffer();
  }
  return sharp(base)
    .composite([{ input: warped, blend: "multiply" }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}
// Called only after the caller has authorized this product/preview. Rebuild a
// disposable derivative without changing listing IDs, placements or order history.
export async function currentProductMockup(c, db, p) {
  if (
    !p?.design_studio ||
    !mockupMatches(p.mockup_upload_id, p.upload_id, p.category, p.design_studio)
  )
    return null;
  const id = mockupId(p.upload_id, p.category, p.design_studio);
  const source = await db.one("SELECT * FROM uploads WHERE id=?", [
    p.upload_id,
  ]);
  if (!source) return null;
  await ensureMockup(c, db, id, source.user_id, async () =>
    renderMockup(
      await artworkRenderSource(c.uploadDir, source),
      p.category,
      p.design_studio,
    ),
  );
  return db.one("SELECT * FROM uploads WHERE id=?", [id]);
}
// Single-flight rendering prevents concurrent saves producing duplicate uploads.
export async function ensureMockup(c, db, id, owner, render) {
  if (loading.has(id)) return loading.get(id);
  const work = (async () => {
    const name = id + ".jpg",
      file = path.join(c.uploadDir, name),
      existing = await db.one("SELECT id FROM uploads WHERE id=?", [id]);
    if (existing)
      try {
        await fs.access(file);
        return id;
      } catch {}
    const bytes = await render();
    try {
      await fs.writeFile(file, bytes, { mode: 0o600, flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    await db.q("INSERT IGNORE INTO uploads VALUES (?,?,?,?)", [
      id,
      owner,
      name,
      "image/jpeg",
    ]);
    return id;
  })();
  loading.set(id, work);
  try {
    return await work;
  } finally {
    loading.delete(id);
  }
}
