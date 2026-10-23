import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateDesignStudio, mockupId } from "../src/design-studio.js";
import { renderDesignTexture, renderMockup, currentProductMockup } from "../src/mockup-renderer.js";

const image = (id, upload_id, change = {}) => ({
  id,
  type: "image",
  upload_id,
  x: 0.5,
  y: 0.5,
  width: 0.6,
  height: 0.6,
  rotation: 0,
  opacity: 1,
  visible: true,
  locked: false,
  ...change,
});
const text = (change = {}) => ({
  id: "words",
  type: "text",
  text: "Hello",
  font: "arabic",
  color: "#ffffff",
  x: 0.5,
  y: 0.5,
  size: 0.15,
  rotation: 0,
  opacity: 1,
  visible: true,
  locked: false,
  align: "center",
  direction: "auto",
  ...change,
});
const scene = (layers = [], background = "transparent") => ({ background, layers });
const studio = (scenes, primary = null) =>
  validateDesignStudio({
    version: 1,
    template_version: "veelad-generic-1",
    artwork_id: primary,
    active_product: "shirt",
    placements: {},
    scene_version: "veelad-scene-1",
    scenes,
  }, primary);
const solid = (background) => sharp({
  create: { width: 200, height: 200, channels: 4, background },
}).png().toBuffer();
const pixel = (bytes, left, top) => sharp(bytes).ensureAlpha().extract({ left, top, width: 1, height: 1 }).raw().toBuffer();

test("scene compositing preserves ordered image layers, opacity, visibility and independent shirt sides", async () => {
  const red = await solid("#ff0000"), blue = await solid("#0000ff"), green = await solid("#00ff00"),
    sources = new Map([["art-red", red], ["art-blue", blue], ["art-green", green]]),
    s = studio({ shirt: {
      front: scene([
        image("red", "art-red", { x: 0.4, y: 0.4 }),
        image("blue", "art-blue", { x: 0.6, y: 0.6, opacity: 0.5 }),
        image("hidden", "art-missing", { visible: false }),
      ]),
      back: scene([image("green", "art-green", { locked: true })]),
    } });
  const front = await renderDesignTexture(sources, "T-shirts", s, 250),
    back = await renderDesignTexture(sources, "T-shirts", s, 250, { surface: "back" });
  assert.deepEqual([...await pixel(front, 60, 72)], [255, 0, 0, 255]);
  const overlap = await pixel(front, 125, 150);
  assert.ok(Math.abs(overlap[0] - 127) <= 1);
  assert.equal(overlap[1], 0);
  assert.ok(Math.abs(overlap[2] - 128) <= 1);
  assert.equal(overlap[3], 255);
  assert.deepEqual([...await pixel(back, 125, 150)], [0, 255, 0, 255]);
  assert.equal((await pixel(front, 240, 290))[3], 0);
  assert.deepEqual((await sharp(front).metadata()).width, 250);
  assert.deepEqual((await sharp(front).metadata()).height, 300);
  const frontMockup = await renderMockup(sources, "T-shirts", s),
    backMockup = await renderMockup(sources, "T-shirts", s, { surface: "back" });
  assert.equal((await sharp(frontMockup).metadata()).width, 1000);
  assert.notDeepEqual(frontMockup, backMockup);
  assert.equal(s.placements.shirt.view, "shirt", "Exporting the back never mutates the saved preview or front scene");
});

test("unprinted shirt back stays blank while mug camera angles share one wrap", async () => {
  const source = await solid("#ea3412"), sources = new Map([["art-red", source]]),
    s = studio({ shirt: { front: scene([image("red", "art-red")]) }, mug: { wrap: scene([image("red", "art-red")]) } });
  const blankBack = await renderDesignTexture(sources, "T-shirts", s, 200, { surface: "back" });
  assert.equal((await sharp(blankBack).stats()).channels[3].max, 0);
  const mugFront = await renderDesignTexture(sources, "Mugs", s, 500);
  s.placements.mug.view = "mug-back";
  assert.deepEqual(mugFront, await renderDesignTexture(sources, "Mugs", s, 500));
});

test("text and image layers interleave instead of forcing all text above the images", async () => {
  const blue = await solid("#0000ff"), sources = new Map([["art-blue", blue]]),
    fullImage = image("blue", "art-blue", { width: 1, height: 1 }),
    above = studio({ shirt: { front: scene([fullImage, text()]) } }),
    below = studio({ shirt: { front: scene([text(), fullImage]) } }),
    only = studio({ shirt: { front: scene([fullImage]) } });
  const imageOnly = await renderDesignTexture(sources, "T-shirts", only, 300);
  assert.deepEqual(await renderDesignTexture(sources, "T-shirts", below, 300), imageOnly);
  assert.notDeepEqual(await renderDesignTexture(sources, "T-shirts", above, 300), imageOnly);
});

test("private source resolver loads only visible layers on the requested print surface", async () => {
  const red = await solid("#ff0000"), calls = [],
    s = studio({ shirt: {
      front: scene([image("red", "art-red"), image("hidden", "art-hidden", { visible: false })]),
      back: scene([image("blue", "art-blue")]),
    } });
  const resolveSource = async (id) => { calls.push(id); return red; };
  await renderDesignTexture(null, "T-shirts", s, 100, { resolveSource });
  assert.deepEqual(calls, ["art-red"]);
  await assert.rejects(renderDesignTexture(null, "T-shirts", s, 100), /image is unavailable/);
  await assert.rejects(renderDesignTexture(red, "T-shirts", s, 100), /image is unavailable/, "A single buffer cannot silently stand in for other image IDs");
  const primary = studio({ shirt: { front: scene([image("red", "art-red")]) } }, "art-red");
  assert.ok((await renderDesignTexture(red, "T-shirts", primary, 100)).length > 0);
});

test("enlarged and rotated layers clip to the artboard, and patterns retain bounded repetition", async () => {
  const source = await solid("#eb4521"), sources = new Map([["art-red", source]]),
    s = studio({ sticker: { front: scene([image("red", "art-red", { width: 3, height: 3, rotation: 45, x: 0.05 })]) } });
  const clipped = await renderDesignTexture(sources, "Stickers", s, 180);
  assert.equal((await sharp(clipped).metadata()).width, 180);
  assert.equal((await pixel(clipped, 90, 90))[3], 255);
  s.scenes.sticker.front.layers = [image("red", "art-red", { width: 0.3, height: 0.3, repeat: true })];
  const repeated = await renderDesignTexture(sources, "Stickers", s, 180);
  assert.equal((await pixel(repeated, 1, 1))[3], 255);
  s.scenes.sticker.front.layers[0].width = 0.01;
  s.scenes.sticker.front.layers[0].height = 0.01;
  await assert.rejects(renderDesignTexture(sources, "Stickers", s, 180), /pattern is too dense/);
});

test("native print export retains detail above bounded preview resolution", async () => {
  const stripe = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1800"><defs><pattern id="p" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="white"/><rect width="1" height="2" fill="black"/></pattern></defs><rect width="1800" height="1800" fill="url(#p)"/></svg>'),
    original = await sharp(stripe).png().toBuffer(),
    s = studio({ sticker: { front: scene([image("stripes", "art-native", { width: 1, height: 1 })]) } }),
    printed = await renderDesignTexture(null, "Stickers", s, 1800, { resolveSource: async () => original });
  assert.equal((await sharp(printed).metadata()).width, 1800);
  assert.equal((await pixel(printed, 900, 900))[0], 0);
  assert.equal((await pixel(printed, 901, 900))[0], 255);
  assert.equal((await pixel(printed, 902, 900))[0], 0);
  assert.equal((await pixel(printed, 903, 900))[0], 255);
});

test("authorized product previews rebuild assigned mixed-uploader scenes and text-only scenes", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "veelad-scene-preview-"));
  try {
    await fs.writeFile(path.join(directory, "art-red.png"), await solid("#ff0000"));
    await fs.writeFile(path.join(directory, "art-blue.png"), await solid("#0000ff"));
    const rows = new Map([
      ["art-red", { id: "art-red", user_id: "artist-1", path: "art-red.png", mime: "image/png" }],
      ["art-blue", { id: "art-blue", user_id: "administrator-1", path: "art-blue.png", mime: "image/png" }],
    ]), db = {
      one: async (_query, [id]) => { assert.notEqual(id, undefined); return rows.get(id) || null; },
      q: async (_query, [id, user_id, filename, mime]) => { rows.set(id, { id, user_id, path: filename, mime }); },
    }, s = studio({ shirt: { front: scene([image("red", "art-red"), image("blue", "art-blue", { width: .3, height: .3 })]) } }, "art-red"),
      p = { id: "p-assigned", artist_id: "artist-1", upload_id: "art-red", category: "T-shirts", design_studio: s };
    p.mockup_upload_id = mockupId(p.upload_id, p.category, s);
    const rebuilt = await currentProductMockup({ uploadDir: directory }, db, p);
    assert.equal(rebuilt.id, p.mockup_upload_id);
    assert.equal((await sharp(path.join(directory, rebuilt.path)).metadata()).width, 1000);
    const words = studio({ shirt: { front: scene([text()]) } }),
      textProduct = { id: "p-text-only", artist_id: "artist-1", upload_id: null, category: "T-shirts", design_studio: words };
    textProduct.mockup_upload_id = mockupId(null, textProduct.category, words);
    const textPreview = await currentProductMockup({ uploadDir: directory }, db, textProduct);
    assert.equal(textPreview.user_id, "artist-1");
    assert.equal((await sharp(path.join(directory, textPreview.path)).metadata()).width, 1000);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
