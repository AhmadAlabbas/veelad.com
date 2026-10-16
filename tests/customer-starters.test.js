import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import sharp from "sharp";
import { renderTextGlyph, validateTextLayers } from "../src/text-layers.js";

test("all eight editable starter layouts fit actual shaped glyphs on every provisional product in both languages", async () => {
  let language = "en";
  class PreviewImage {
    async decode() {
      const meta = await sharp(Buffer.from(this.src.split(",")[1], "base64")).metadata();
      this.naturalWidth = meta.width;
      this.naturalHeight = meta.height;
    }
  }
  const products = JSON.parse(await fs.readFile("public/assets/print-products.json", "utf8")).products;
  const context = vm.createContext({
    document: { documentElement: {} },
    MutationObserver: class { observe() {} },
    Image: PreviewImage,
    currentLanguage: () => language,
    t: (text) => text,
    api: async (route, data) => {
      assert.equal(route, "customer-text-preview");
      const product = products.find((item) => item.category === data.category);
      const layers = validateTextLayers({ [product.id]: data.layers })[product.id];
      return { layers: await Promise.all(layers.map(async (layer) => ({ id: layer.id, image: "data:image/png;base64," + (await renderTextGlyph(layer)).toString("base64") }))) };
    },
  });
  vm.runInContext(await fs.readFile("public/assets/customer-starters.js", "utf8"), context);
  const starters = vm.runInContext("customerStarters", context),
    defaults = vm.runInContext("starterDefaults", context),
    makeLayers = vm.runInContext("starterLayers", context),
    fit = vm.runInContext("fitStarterLayers", context);
  assert.equal(starters.length, 8);
  assert.equal(new Set(starters.map((starter) => starter.id)).size, 8);
  for (language of ["en", "ar"]) for (const product of products) for (const starter of starters) {
    const layers = makeLayers(starter, defaults(starter), product), original = structuredClone(layers);
    const glyphs = await fit(layers, product), height = 900 * product.preview[1] / product.preview[0];
    assert.ok(layers.length >= 2 && layers.length <= 4);
    for (const layer of layers) {
      const { image } = glyphs.find((glyph) => glyph.id === layer.id);
      const label = `${language}/${product.id}/${starter.id}/${layer.id}`;
      assert.ok(image.naturalWidth <= 900 * .84, label + " width");
      assert.ok(layer.x * 900 - image.naturalWidth / 2 >= 900 * .05, label + " left");
      assert.ok(layer.x * 900 + image.naturalWidth / 2 <= 900 * .95, label + " right");
      assert.ok(layer.y * height - image.naturalHeight / 2 >= height * .05, label + " top");
      assert.ok(layer.y * height + image.naturalHeight / 2 <= height * .95, label + " bottom");
      assert.ok(layer.size >= .02 && layer.size <= .2, label + " valid size");
      assert.equal(layer.text, original.find((item) => item.id === layer.id).text);
      assert.equal(layer.rotation, 0, label + " not mirrored or rotated");
    }
    const rows = glyphs.map(({ id, image }) => ({ y: layers.find((layer) => layer.id === id).y * height, height: image.naturalHeight })).sort((a, b) => a.y - b.y);
    for (let index = 1; index < rows.length; index++) assert.ok(rows[index - 1].y + rows[index - 1].height / 2 < rows[index].y - rows[index].height / 2, `${language}/${product.id}/${starter.id}: separate rows`);
  }
});
