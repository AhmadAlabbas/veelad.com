import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  validateTextLayers,
  renderTextGlyph,
  effectiveFont,
} from "../src/text-layers.js";
import {
  validateDesignStudio,
  mockupId,
  productionPlan,
} from "../src/design-studio.js";
import { renderDesignTexture, renderMockup } from "../src/mockup-renderer.js";
const layer = {
  id: "text-1",
  text: "مرحبا Veelad",
  font: "arabic",
  color: "#bc2030",
  x: 0.5,
  y: 0.5,
  size: 0.08,
  rotation: 0,
  align: "center",
  direction: "auto",
};
const studio = (layers = [layer]) =>
  validateDesignStudio(
    {
      version: 1,
      template_version: "veelad-generic-1",
      artwork_id: null,
      active_product: "shirt",
      placements: {},
      text_layers: { shirt: layers },
    },
    null,
  );
test("text layers validate bounds, count, fonts, colours, Unicode and escaped content", () => {
  assert.equal(
    validateTextLayers({ shirt: [layer] }).shirt[0].text,
    layer.text,
  );
  for (const change of [
    { font: "../../secret" },
    { font: ["arabic"] },
    { color: ["#bc2030"] },
    { color: "url(https://example.com)" },
    { x: 2 },
    { size: 0.5 },
    { rotation: 181 },
    { text: "x".repeat(121) },
    { text: "a\nb\nc\nd\ne" },
    { text: "hidden\u202e" },
  ])
    assert.throws(() =>
      validateTextLayers({ shirt: [{ ...layer, ...change }] }),
    );
  assert.throws(() => validateTextLayers({ shirt: Array(5).fill(layer) }));
  assert.throws(() => validateTextLayers({ unknown: [layer] }));
  assert.equal(
    effectiveFont({ ...layer, font: "manrope" }).family,
    "Veelad Arabic",
  );
  assert.equal(
    effectiveFont({ ...layer, text: "Hello", font: "manrope" }).family,
    "Manrope",
  );
  assert.equal(studio().text_layers.shirt[0].color, "#bc2030");
});
test("bundled fonts shape connected Arabic and render markup as literal text", async () => {
  const joined = await renderTextGlyph({ ...layer, text: "مرحبا" }),
    separate = await renderTextGlyph({
      ...layer,
      text: "م\u200cر\u200cح\u200cب\u200cا",
    });
  assert.notDeepEqual(joined, separate);
  assert.ok((await sharp(joined).metadata()).width > 20);
  const literal = await renderTextGlyph({
    ...layer,
    text: "<b>Hello & welcome</b>",
  });
  assert.ok((await sharp(literal).metadata()).width > 20);
  const stats = await sharp(joined).stats();
  assert.ok(stats.channels[3].max > 0);
  assert.ok(stats.channels[0].max > stats.channels[1].max);
});
test("text-only layouts have distinct previews, full-size printing pixels and saved text instructions", async () => {
  const s = studio(),
    other = studio([{ ...layer, text: "A different design" }]);
  assert.notEqual(
    mockupId(null, "T-shirts", s),
    mockupId(null, "T-shirts", other),
  );
  const old = validateDesignStudio(
    {
      version: 1,
      template_version: "veelad-generic-1",
      artwork_id: null,
      active_product: "shirt",
      placements: {},
    },
    null,
  );
  assert.equal(
    mockupId(null, "T-shirts", old),
    mockupId(null, "T-shirts", { ...old, text_layers: {} }),
  );
  const png = await renderDesignTexture(null, "T-shirts", s, 4500),
    meta = await sharp(png).metadata();
  assert.equal(meta.width, 4500);
  assert.equal(meta.height, 5400);
  assert.equal(meta.hasAlpha, true);
  const jpeg = await renderMockup(null, "T-shirts", s);
  assert.equal((await sharp(jpeg).metadata()).width, 1000);
  assert.notDeepEqual(jpeg, await renderMockup(null, "T-shirts", other));
  const plan = productionPlan(
    { id: "personal", category: "T-shirts", upload_id: null, design_studio: s },
    null,
  );
  assert.equal(plan.source_upload_id, null);
  assert.equal(plan.products[0].text_layers[0].text, layer.text);
  assert.equal(plan.supplier_confirmed, false);
});
