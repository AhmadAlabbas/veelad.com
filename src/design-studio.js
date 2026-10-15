import fs from "node:fs";
import { createHash } from "node:crypto";
import { fail } from "./security.js";
import {
  defaultPlacement,
  qualityEstimate,
} from "../public/assets/design-math.js";
export const printProducts = JSON.parse(
  fs.readFileSync(
    new URL("../public/assets/print-products.json", import.meta.url),
    "utf8",
  ),
);
export function validateDesignStudio(value, uploadId) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.version !== 1 ||
    value.template_version !== printProducts.version ||
    value.artwork_id !== (uploadId || null) ||
    (value.listing_mockup !== undefined &&
      typeof value.listing_mockup !== "boolean") ||
    !printProducts.products.some((p) => p.id === value.active_product) ||
    !value.placements ||
    typeof value.placements !== "object" ||
    Array.isArray(value.placements)
  )
    fail(422, "Please check the saved design placement.");
  if (
    Object.keys(value.placements).some(
      (key) => !printProducts.products.some((p) => p.id === key),
    )
  )
    fail(422, "Please check the saved design placement.");
  const placements = {};
  for (const product of printProducts.products) {
    const p = value.placements[product.id] ?? defaultPlacement(product);
    if (
      !p ||
      typeof p !== "object" ||
      Array.isArray(p) ||
      !Number.isFinite(p.x) ||
      p.x < 0 ||
      p.x > 1 ||
      !Number.isFinite(p.y) ||
      p.y < 0 ||
      p.y > 1 ||
      !Number.isFinite(p.scale) ||
      p.scale < 0.1 ||
      p.scale > 2 ||
      !Number.isFinite(p.rotation) ||
      p.rotation < -180 ||
      p.rotation > 180 ||
      typeof p.repeat !== "boolean" ||
      !(
        p.background === "transparent" || /^#[a-fA-F0-9]{6}$/.test(p.background)
      ) ||
      !product.views.includes(p.view)
    )
      fail(422, "Please check the saved design placement.");
    placements[product.id] = {
      x: p.x,
      y: p.y,
      scale: p.scale,
      rotation: p.rotation,
      repeat: p.repeat,
      background: p.background,
      view: p.view,
    };
  }
  return {
    version: 1,
    template_version: printProducts.version,
    artwork_id: uploadId || null,
    active_product: value.active_product,
    listing_mockup: value.listing_mockup !== false,
    placements,
  };
}
export const printProductFor = (category) =>
  printProducts.products.find((p) => p.category === category);
export function mockupId(
  uploadId,
  category,
  studio,
  renderVersion = printProducts.render_version,
) {
  const product = printProductFor(category);
  if (!product || !studio?.placements?.[product.id]) return null;
  return (
    "mock-" +
    createHash("sha256")
      .update(
        JSON.stringify({
          version: printProducts.version,
          ...(renderVersion ? { render_version: renderVersion } : {}),
          source: uploadId,
          product: product.id,
          placement: studio.placements[product.id],
        }),
      )
      .digest("hex")
      .slice(0, 40)
  );
}
// The logical print placement is unchanged when a photographic base is upgraded.
// Accept the original renderer's IDs, but never accept arbitrary upload pointers.
export function mockupMatches(id, uploadId, category, studio) {
  return (
    !!id &&
    (id === mockupId(uploadId, category, studio) ||
      id === mockupId(uploadId, category, studio, null))
  );
}
export function productionPlan(product, metadata) {
  if (!product.design_studio) return null;
  return {
    version: 1,
    product_id: product.id,
    source_upload_id: product.upload_id,
    template_version: printProducts.version,
    template_status: "provisional",
    supplier_confirmed: false,
    original: metadata
      ? {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          size_bytes: metadata.size_bytes,
        }
      : null,
    instructions:
      "Visual placement only. Confirm supplier printable area, bleed, colour, material and physical sample before printing. Originals are unchanged.",
    products: printProducts.products
      .filter((p) =>
        [product.category, ...(product.print_formats || [])].includes(
          p.category,
        ),
      )
      .map((p) => ({
        category: p.category,
        placement: product.design_studio.placements[p.id],
        provisional_canvas_pixels: p.canvas,
        quality: metadata
          ? qualityEstimate(
              metadata.width,
              metadata.height,
              p,
              product.design_studio.placements[p.id],
            )
          : null,
      })),
  };
}
