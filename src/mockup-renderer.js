import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  imageLayout,
  patternCenters,
  affineTriangle,
  triangleClip,
} from "../public/assets/design-math.js";
import { printProductFor } from "./design-studio.js";
import { fail } from "./security.js";
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
export async function renderMockup(preview, category, studio) {
  const product = printProductFor(category),
    placement = studio.placements[product.id],
    info = await sharp(preview).metadata();
  const cw = 900,
    ch = Math.round((cw * product.preview[1]) / product.preview[0]),
    layout = imageLayout(info.width, info.height, cw, ch, placement),
    centers = patternCenters(layout, cw, ch, placement.repeat);
  if (!centers)
    fail(
      422,
      "The pattern is too dense. Increase its scale or use a single placement.",
    );
  const rotated = await sharp(preview)
      .resize(
        Math.max(1, Math.round(layout.width)),
        Math.max(1, Math.round(layout.height)),
        { fit: "fill" },
      )
      .rotate(placement.rotation, { background: "#00000000" })
      .png()
      .toBuffer(),
    rotInfo = await sharp(rotated).metadata(),
    overlays = [];
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
  const { base, projection } = await template(placement.view),
    definitions = [],
    triangles = [];
  for (const [i, indices] of projection.triangles.entries()) {
    const points = indices.map((index) => projection.vertices[index]),
      source = points.map((p) => [p[2] * cw, p[3] * ch]),
      target = points.map((p) => [p[0], p[1]]),
      matrix = affineTriangle(source, target);
    if (!matrix) continue;
    definitions.push(
      `<clipPath id="c${i}"><polygon points="${triangleClip(target)
        .map((p) => p.join(","))
        .join(" ")}"/></clipPath>`,
    );
    triangles.push(
      `<g clip-path="url(#c${i})"><use href="#design" transform="matrix(${matrix.join(" ")})"/></g>`,
    );
  }
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${projection.width}" height="${projection.height}"><defs><image id="design" width="${cw}" height="${ch}" href="data:image/png;base64,${texture.toString("base64")}"/>${definitions.join("")}</defs>${triangles.join("")}</svg>`,
  );
  const warped = await sharp(svg, { limitInputPixels: 4000000 })
    .png()
    .toBuffer();
  return sharp(base)
    .composite([{ input: warped, blend: "multiply" }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
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
