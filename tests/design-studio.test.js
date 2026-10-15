import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  defaultPlacement,
  imageLayout,
  patternCenters,
  qualityEstimate,
  pointToUV,
  projectTexture,
} from "../public/assets/design-math.js";
import {
  printProducts,
  validateDesignStudio,
  mockupId,
  mockupMatches,
  productionPlan,
} from "../src/design-studio.js";
import { renderMockup } from "../src/mockup-renderer.js";
const [shirt, , , , phone] = printProducts.products;
const studio = () => ({
  version: 1,
  template_version: printProducts.version,
  artwork_id: "art-original",
  active_product: "shirt",
  listing_mockup: true,
  placements: Object.fromEntries(
    printProducts.products.map((p) => [p.id, defaultPlacement(p)]),
  ),
});
test("resolution uses original pixels and placed size, rotation warns about cropping, unknown templates never claim DPI", () => {
  const p = defaultPlacement(shirt),
    quality = qualityEstimate(4500, 5400, shirt, p);
  assert.equal(quality.level, "recommended");
  assert.equal(quality.dpi, 416);
  assert.equal(qualityEstimate(300, 360, shirt, p).level, "low");
  p.scale = 1;
  p.rotation = 90;
  assert.equal(qualityEstimate(4500, 5400, shirt, p).cropped, true);
  assert.equal(
    qualityEstimate(9000, 9000, phone, defaultPlacement(phone)).level,
    "template_required",
  );
  assert.equal(
    qualityEstimate(9000, 9000, phone, defaultPlacement(phone)).dpi,
    null,
  );
  const layout = imageLayout(400, 4, 900, 900, { ...p, scale: 0.1 });
  assert.equal(patternCenters(layout, 900, 900, true), null);
  assert.ok(
    patternCenters(
      {
        ...layout,
        width: 300,
        height: 300,
        bounds: { width: 300, height: 300 },
      },
      900,
      900,
      true,
    ).length < 30,
  );
  const projection = {
    vertices: [
      [0, 0, 0, 0],
      [100, 0, 1, 0],
      [0, 100, 0, 1],
    ],
    triangles: [[0, 1, 2]],
  };
  assert.deepEqual(pointToUV([25, 25], projection), { x: 0.25, y: 0.25 });
  assert.equal(pointToUV([90, 90], projection), null);
});
test("placement validation binds every layout to an original, bounds controls and produces stable source-specific mockup IDs", () => {
  const input = studio(),
    valid = validateDesignStudio(input, "art-original");
  assert.deepEqual(valid, input);
  for (const bad of [
    null,
    { ...input, artwork_id: "someone-else" },
    { ...input, template_version: "obsolete" },
    { ...input, placements: { ...input.placements, unexpected: {} } },
    ...["scale", "x", "rotation", "background", "view", "repeat"].map(
      (key) => ({
        ...input,
        placements: {
          ...input.placements,
          shirt: {
            ...input.placements.shirt,
            [key]: {
              scale: Infinity,
              x: -1,
              rotation: 181,
              background: "url(https://bad)",
              view: "../../file",
              repeat: "yes",
            }[key],
          },
        },
      }),
    ),
  ])
    assert.throws(() => validateDesignStudio(bad, "art-original"), {
      status: 422,
    });
  assert.equal(
    mockupId("art-original", "T-shirts", valid),
    mockupId("art-original", "T-shirts", structuredClone(valid)),
  );
  assert.notEqual(
    mockupId("replacement", "T-shirts", valid),
    mockupId("art-original", "T-shirts", valid),
  );
  const changed = structuredClone(valid);
  const legacyId = mockupId("art-original", "T-shirts", valid, null);
  assert.notEqual(legacyId, mockupId("art-original", "T-shirts", valid));
  assert.equal(
    mockupMatches(legacyId, "art-original", "T-shirts", valid),
    true,
  );
  assert.equal(
    mockupMatches(legacyId, "replacement", "T-shirts", valid),
    false,
  );
  changed.placements.shirt.rotation = 15;
  assert.notEqual(
    mockupId("art-original", "T-shirts", changed),
    mockupId("art-original", "T-shirts", valid),
  );
  const plan = productionPlan(
    {
      id: "listing",
      upload_id: "art-original",
      category: "Phone cases",
      print_formats: [],
      design_studio: valid,
    },
    { width: 4000, height: 5000, format: "png", size_bytes: 10000 },
  );
  assert.equal(plan.supplier_confirmed, false);
  assert.equal(plan.products[0].quality.dpi, null);
  assert.equal(plan.source_upload_id, "art-original");
});
test("surface projection preserves translucent ink without dark seams or opaque fringes", () => {
  const projection = {
    width: 8,
    height: 8,
    vertices: [
      [0, 0, 0, 0],
      [8, 0, 1, 0],
      [8, 8, 1, 1],
      [0, 8, 0, 1],
      [4, 4, 0.5, 0.5],
    ],
    triangles: [
      [0, 1, 4],
      [1, 2, 4],
      [2, 3, 4],
      [3, 0, 4],
    ],
  };
  const source = new Uint8ClampedArray(4 * 4 * 4);
  for (let i = 0; i < source.length; i += 4) source.set([200, 80, 50, 128], i);
  const result = projectTexture(source, 4, 4, projection);
  for (let i = 0; i < result.length; i += 4)
    assert.deepEqual([...result.slice(i, i + 4)], [200, 80, 50, 128]);
  const transparent = new Uint8ClampedArray(source.length);
  assert.ok(
    projectTexture(transparent, 4, 4, projection).every((value) => value === 0),
  );
});
test("every generic product renders a bounded mockup without changing source bytes or exporting a print proof", async () => {
  const source = await sharp({
      create: { width: 800, height: 1000, channels: 4, background: "#e66038" },
    })
      .png()
      .toBuffer(),
    copy = Buffer.from(source),
    state = studio();
  for (const p of printProducts.products) {
    const result = await renderMockup(source, p.category, state),
      metadata = await sharp(result).metadata();
    assert.equal(metadata.width, 1000);
    assert.equal(metadata.height, 1000);
    assert.equal(metadata.format, "jpeg");
    assert.ok(result.length > 3000);
    // Sharp stats reads its input, so materialize the crop before measuring it.
    const crop = await sharp(result)
      .extract({ left: 350, top: 450, width: 300, height: 300 })
      .toBuffer();
    const diff = await sharp(crop).stats();
    assert.ok(
      diff.channels[0].mean > diff.channels[2].mean + 8,
      p.id + " should show the colored artwork",
    );
  }
  assert.deepEqual(source, copy);
});
test("phone camera openings stay unprinted even when artwork fills the complete surface", async () => {
  const source = await sharp({
      create: { width: 1000, height: 1000, channels: 4, background: "#ed6831" },
    })
      .png()
      .toBuffer(),
    state = studio();
  state.placements.phone.scale = 2;
  const rendered = await renderMockup(source, "Phone cases", state),
    base = await sharp(
      new URL("../public/assets/mockups/phone.webp", import.meta.url).pathname,
    ).toBuffer();
  const pixel = async (bytes, left, top) =>
    sharp(bytes).extract({ left, top, width: 1, height: 1 }).raw().toBuffer();
  const actual = await pixel(rendered, 360, 160),
    expected = await pixel(base, 360, 160);
  for (let i = 0; i < 3; i++)
    assert.ok(
      Math.abs(actual[i] - expected[i]) < 12,
      "Camera must retain the photographic base",
    );
  const ink = await pixel(rendered, 550, 500);
  assert.ok(ink[0] > ink[2] + 80, "The case body should contain the artwork");
});
