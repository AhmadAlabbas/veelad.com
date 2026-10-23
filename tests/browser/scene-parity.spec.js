import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import sharp from "sharp";
import { printProductFor, validateDesignStudio } from "../../src/design-studio.js";
import { renderDesignTexture } from "../../src/mockup-renderer.js";
import { renderTextGlyph } from "../../src/text-layers.js";

const assets = new URL("../../public/assets/", import.meta.url);
const image = (id, upload_id, rest = {}) => ({
  id, type: "image", upload_id, x: .5, y: .5, width: .7, height: .7,
  rotation: 0, opacity: 1, visible: true, locked: false, repeat: false, ...rest,
});

test("the actual browser scene compositor matches print ordering, Arabic glyphs and translucent image transforms", async ({ page }) => {
  const red = await sharp({ create: { width: 600, height: 800, channels: 4, background: "#e94d32" } }).png().toBuffer(),
    blue = await sharp({ create: { width: 400, height: 400, channels: 4, background: "#3859c6" } }).png().toBuffer(),
    sources = new Map([["art-red", red], ["art-blue", blue]]),
    lettering = {
      id: "greeting", type: "text", text: "مرحبا Veelad", font: "arabic-bold", color: "#152b42",
      x: .5, y: .47, size: .075, rotation: 9, opacity: .86, visible: true, locked: false,
      align: "center", direction: "auto",
    },
    studio = validateDesignStudio({
      version: 1, template_version: "veelad-generic-1", artwork_id: null,
      active_product: "shirt", placements: {}, scene_version: "veelad-scene-1",
      scenes: { shirt: { front: { background: "#f5f0e9", layers: [
        image("pattern", "art-blue", { width: .22, height: .16, repeat: true, rotation: 18, opacity: .22 }),
        image("warm", "art-red", { x: .42, y: .53, width: .68, height: .64, rotation: -13, opacity: .73 }),
        lettering,
        image("cool", "art-blue", { x: .7, y: .7, width: .23, height: .23, rotation: 27, opacity: .62 }),
      ] } } },
    }, null),
    product = printProductFor("T-shirts"),
    glyph = await renderTextGlyph(lettering, 900);
  await page.setContent('<!doctype html><html><body><main id="stage"></main></body></html>');
  // Exercise the production browser functions; do not replace their geometry or
  // composition with a test implementation that would conceal a parity bug.
  await page.addScriptTag({ content: (await fs.readFile(new URL("design-math.js", assets), "utf8")).replaceAll("export ", "") });
  await page.addScriptTag({ path: new URL("customer-text.js", assets).pathname });
  await page.addScriptTag({ path: new URL("customer-scenes.js", assets).pathname });
  const clientPng = await page.evaluate(async ({ studio, product, inputs, glyph }) => {
    const load = async (src) => { const image = new Image(); image.src = src; await image.decode(); return image; },
      images = new Map(await Promise.all(inputs.map(async ([id, src]) => [id, await load(src)]))),
      words = await load(glyph), root = document.getElementById("stage"),
      instance = { state: studio, root, product: () => product, math: { patternCenters }, sceneEditor: {
        image: async (id) => images.get(id), glyph: async () => words,
      } };
    const result = await customerSceneTexture(instance, product);
    root.append(result);
    return result.toDataURL("image/png");
  }, {
    studio, product,
    inputs: [...sources].map(([id, bytes]) => [id, "data:image/png;base64," + bytes.toString("base64")]),
    glyph: "data:image/png;base64," + glyph.toString("base64"),
  });
  const serverPng = await renderDesignTexture(sources, "T-shirts", studio, 900),
    [client, server] = await Promise.all([
      sharp(Buffer.from(clientPng.split(",")[1], "base64")).flatten({ background: "#ffffff" }).raw().toBuffer(),
      sharp(serverPng).flatten({ background: "#ffffff" }).raw().toBuffer(),
    ]);
  expect(client.length).toBe(server.length);
  let squared = 0, absolute = 0;
  for (let index = 0; index < client.length; index++) {
    const difference = client[index] - server[index];
    squared += difference * difference;
    absolute += Math.abs(difference);
  }
  // Cairo/librsvg and Chromium use slightly different edge anti-aliasing, while
  // the visible positions, source pixels, text shaping and layer order agree.
  expect(Math.sqrt(squared / client.length)).toBeLessThan(4);
  expect(absolute / client.length).toBeLessThan(1.5);
  await expect(page.locator("#stage canvas")).toHaveAttribute("width", "900");
  await expect(page.locator("#stage canvas")).toHaveAttribute("height", "1080");
});
