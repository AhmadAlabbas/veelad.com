import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import vm from "node:vm";
import sharp from "sharp";
import {
  designFonts, fontCatalogue, fontPath, supportsText, missingGlyphs,
  legacyFontForText,
} from "../src/font-library.js";

const manifestUrl = new URL("../public/assets/design-fonts.json", import.meta.url);
const browserUrl = new URL("../public/assets/design-fonts.js", import.meta.url);

test("licensed local catalogue is complete, unique, reproducible and safe", async () => {
  assert.ok(fontCatalogue.length >= 140);
  assert.ok(fontCatalogue.length <= 160);
  assert.equal(new Set(fontCatalogue.map((font) => font.id)).size, fontCatalogue.length);
  assert.ok(fontCatalogue.filter((font) => font.scripts.includes("Arab")).length >= 25);
  for (const font of fontCatalogue) {
    assert.match(font.id, /^[a-z0-9-]+$/u);
    assert.match(font.file, /^(library\/)?[a-z0-9-]+\.ttf$/u);
    assert.ok(["OFL-1.1", "Apache-2.0"].includes(font.license));
    const bytes = await fs.readFile(fontPath(font.id));
    assert.equal(bytes.length, font.bytes, font.id);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), font.sha256, font.id);
    const license = await fs.readFile(new URL("../public/assets/fonts/" + font.license_file, import.meta.url), "utf8");
    assert.match(license, /SIL OPEN FONT LICENSE|Apache License/u);
    if (!font.legacy) {
      assert.match(font.source, /githubusercontent\.com\/google\/fonts\/[a-f0-9]{40}\//u);
      assert.ok(font.copyright?.length > 0, font.id);
    }
    assert.equal(supportsText(font.id, font.sample), true, font.id + " sample");
    assert.ok(Object.isFrozen(font));
  }
  for (const invalid of ["../../.env", "toString", "__proto__", ["cairo"], null])
    assert.throws(() => fontPath(invalid), /Unknown design font/u);
});

test("coverage validates actual characters across scripts and preserves saved font IDs", () => {
  for (const [id, text] of [
    ["cairo", "صمّم بأسلوبك Hello 123"],
    ["noto-sans-hebrew", "שלום עולם"],
    ["noto-sans-devanagari", "नमस्ते दुनिया"],
    ["noto-sans-thai", "สวัสดีโลก"],
    ["noto-sans-jp", "自分らしく、自由に"],
    ["noto-sans-sc", "创造属于你的风格"],
    ["noto-sans-tc", "創造屬於你的風格"],
    ["noto-sans-kr", "나만의 디자인"],
  ]) assert.equal(supportsText(id, text), true, id);
  assert.equal(supportsText("manrope", "مرحبا"), false);
  assert.equal(supportsText("cairo", "नमस्ते"), false);
  assert.equal(supportsText("cairo", "مرحبا 🧑‍🎨"), false);
  assert.deepEqual(missingGlyphs("manrope", "م م"), ["م"]);
  assert.equal(supportsText("cairo", "أهلاً\n\u200f وسهلاً\u200c"), true);
  assert.equal(supportsText("unknown", ""), false);
  assert.equal(legacyFontForText({ font: "manrope", text: "مرحبا" }), designFonts.arabic);
  assert.equal(legacyFontForText({ font: "dm-sans", text: "Hello" }), designFonts["dm-sans"]);
  assert.equal(legacyFontForText({ font: "inter", text: "مرحبا" }), designFonts.inter);
  assert.equal(designFonts.arabic.family, "Veelad Arabic");
  assert.equal(designFonts["arabic-bold"].file, "veelad-arabic-700.ttf");
});

test("Pango renders selected local files for Arabic, Indic, CJK and display fonts", async () => {
  for (const id of ["cairo", "amiri", "caveat", "bungee", "noto-sans-hebrew", "noto-sans-devanagari", "noto-sans-thai", "noto-sans-jp", "noto-sans-kr"]) {
    const font = designFonts[id];
    const output = await sharp({ text: {
      text: font.sample,
      font: font.family + " 48",
      fontfile: fontPath(id),
      rgba: true,
    } }).png().toBuffer();
    const meta = await sharp(output).metadata();
    assert.ok(meta.width > 10 && meta.height > 10, id);
    assert.equal(meta.hasAlpha, true);
    assert.ok((await sharp(output).stats()).channels[3].max > 0, id);
  }
});

test("browser catalogue searches scripts, lazily loads exact local bytes and bounds concurrency", async () => {
  const manifest = JSON.parse(await fs.readFile(manifestUrl, "utf8"));
  const requested = [], faces = [], added = [];
  let active = 0, peak = 0;
  const context = {
    URL, Map, Set, Promise, console,
    location: { origin: "https://veelad.test" },
    document: { currentScript: { src: "https://veelad.test/assets/design-fonts.js?v=release123" }, fonts: { add: (face) => added.push(face) } },
    window: {},
    fetch: async (url) => { requested.push(url); return { ok: true, json: async () => manifest }; },
    FontFace: class {
      constructor(family, source) { this.family = family; this.source = source; faces.push(this); }
      async load() {
        active++; peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active--; return this;
      }
    },
  };
  vm.runInNewContext(await fs.readFile(browserUrl, "utf8"), context);
  const initialApi = context.window.VeeladFonts;
  assert.equal(requested.length, 0, "ordinary shop pages must not fetch the 449 KB creative-editor catalogue");
  assert.equal(initialApi.catalogue().length, 0);
  assert.equal(initialApi.get("cairo"), null);
  assert.equal(requested.length, 0, "reading the unloaded API must remain cheap");
  const firstReady = initialApi.ready;
  assert.equal(initialApi.ready, firstReady, "all editor callers share one catalogue request");
  const api = await firstReady;
  assert.deepEqual(requested, ["https://veelad.test/assets/design-fonts.json?v=release123"]);
  assert.equal(faces.length, 0, "opening the picker must not download every font");
  assert.equal(api.catalogue().length, manifest.fonts.length);
  assert.ok(api.search("arabic").length >= 25);
  assert.ok(api.search("", { script: "Thai" }).some((font) => font.id === "noto-sans-thai"));
  assert.ok(api.search("Café").every((font) => /cafe/iu.test(font.label)), "accent normalization does not invent results");
  const ids = ["cairo", "amiri", "inter", "bungee", "caveat", "noto-sans-thai", "noto-sans-hebrew", "noto-sans-jp"];
  const results = await Promise.all(ids.map((id) => api.load(id)));
  assert.equal(peak, 4);
  assert.equal(added.length, ids.length);
  assert.deepEqual(results, ids.map((id) => "Veelad Design " + id));
  for (const face of faces) {
    const id = face.family.replace("Veelad Design ", ""), font = designFonts[id];
    assert.equal(face.source, `url("/assets/fonts/${font.file}?v=${font.sha256.slice(0, 16)}")`);
  }
  await api.load("cairo");
  assert.equal(faces.length, ids.length, "repeated selection reuses the loaded font");
  await assert.rejects(api.load("../../.env"), /Unknown design font/u);
  for (const [id, text] of [["cairo", "مرحبا"], ["manrope", "مرحبا"], ["noto-sans-jp", "日本語"], ["cairo", "🧑‍🎨"]])
    assert.equal(api.supports(id, text), supportsText(id, text));
});

test("font selection alone loads the catalogue and a failed network request can recover", async () => {
  const manifest = JSON.parse(await fs.readFile(manifestUrl, "utf8"));
  let requests = 0, faces = 0;
  const context = {
    URL, Map, Set, Promise,
    location: { origin: "https://veelad.test" },
    document: { currentScript: null, fonts: { add() {} } },
    window: {},
    fetch: async () => { requests++; return { ok: requests > 1, json: async () => manifest }; },
    FontFace: class { constructor() { faces++; } async load() { return this; } },
  };
  vm.runInNewContext(await fs.readFile(browserUrl, "utf8"), context);
  const api = context.window.VeeladFonts;
  assert.equal(requests, 0);
  await assert.rejects(api.load("cairo"), /could not load/u);
  assert.equal(requests, 1);
  assert.equal(faces, 0);
  assert.equal(await api.load("cairo"), "Veelad Design cairo");
  assert.equal(requests, 2);
  assert.equal(faces, 1);
  assert.equal(api.catalogue().length, manifest.fonts.length);
});
