import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import sharp from "sharp";
import { config } from "../../src/config.js";
import { database } from "../../src/db.js";
try {
  process.loadEnvFile(".env");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
test.beforeEach(async () => {
  const c = config();
  if (c.mode !== "local" || c.db.database !== "veelad_local")
    throw Error("Studio fixtures require the isolated local database");
  const db = database(c);
  try {
    await db.q("DELETE FROM rate_limits");
  } finally {
    await db.pool.end();
  }
});
const state = (form) =>
  form.locator("[name=design_studio]").inputValue().then(JSON.parse);
test("artist places artwork across seven products, keeps layouts through Arabic switching, rejects bad replacements and reopens the draft", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/en/register");
  let form = page.locator("[data-form=register]");
  await form.locator("[name=name]").fill("Placement artist");
  await form
    .locator("[name=email]")
    .fill("placement-" + Date.now() + "@example.test");
  await form.locator("[name=password]").fill("Placement browser password 123");
  await form.locator("[name=role]").selectOption("artist");
  await form.locator("[type=submit]").click();
  await expect(page).toHaveURL(/studio/);
  await page.goto("/en/studio?tab=upload");
  form = page.locator("[data-form=artist-product]");
  await expect(form.locator(".design-studio")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const title = "Placement draft " + Date.now(),
    bytes = await sharp({
      create: { width: 3000, height: 3600, channels: 4, background: "#d76338" },
    })
      .png()
      .toBuffer();
  await form.locator("[name=title]").fill(title);
  await form.locator("#artwork-file").setInputFiles({
    name: "high-res.png",
    mimeType: "image/png",
    buffer: bytes,
  });
  await expect(form.locator("#upload-status")).toContainText("Artwork ready");
  await expect(form.locator(".studio-canvas-status")).toBeHidden();
  await expect(form.locator(".studio-product")).toHaveCount(7);
  const original = (await state(form)).artwork_id;
  await form.locator(".design-preview-format").selectOption("shirt");
  await form.locator("[data-placement=scale]").fill("85");
  await form.locator("[data-placement=rotation]").fill("12");
  await form.locator("[data-placement=x]").fill("43");
  await form.locator("[data-placement=y]").fill("57");
  await form.locator('[name=print_formats][value="T-shirts"]').check();
  await form.locator(".studio-canvas").focus();
  await page.keyboard.press("ArrowRight");
  expect((await state(form)).placements.shirt.x).toBeCloseTo(0.44);
  await form.locator("[data-studio-select=mug]").click();
  await form.locator("[data-placement=repeat]").check();
  await form.locator("[data-placement=scale]").fill("60");
  await form.locator("[data-studio-select=phone]").click();
  await expect(form.locator("[data-studio-quality]")).toContainText(
    "Supplier template required",
  );
  await form.locator("[data-studio-select=shirt]").click();
  await expect(form.locator("[data-placement=rotation]")).toHaveValue("12");
  const before = await state(form);
  // Decode failure must retain the accepted original and every placement.
  await form.locator("#artwork-file").setInputFiles({
    name: "corrupt.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await expect(form.locator("#upload-status")).toContainText(
    "Use a valid PNG or JPEG",
  );
  expect((await state(form)).artwork_id).toBe(original);
  expect((await state(form)).placements).toEqual(before.placements);
  await expect(form.locator("#upload-preview img")).toBeVisible();
  await page.locator('[data-international-language]').first().selectOption(await page.locator('html').getAttribute('lang')==='ar'?'en':'ar');
  await expect(page).toHaveURL(/\/ar\/studio/);
  await expect(form.locator(".design-studio")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(form.locator(".studio-canvas-status")).toBeHidden();
  expect((await state(form)).placements).toEqual(before.placements);
  await expect(form.locator("[name=title]")).toHaveValue(title);
  await expect(form.locator(".studio-canvas")).toHaveCSS("direction", "ltr");
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
  const downloadPromise = page.waitForEvent("download");
  await form.locator("[data-studio-export]").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("veelad-shirt-preview.png");
  const exported = await fs.readFile(await download.path());
  const image = await sharp(exported).metadata();
  expect(image.width).toBe(1000);
  expect(image.height).toBe(1000);
  expect(exported.equals(bytes)).toBeFalsy();
  await expect(
    form.locator("[data-product=shirt] [data-tile-quality]"),
  ).toContainText("نقطة");
  await form
    .locator(".design-studio")
    .screenshot({ path: info.outputPath("studio-ar.png") });
  await form.locator("[type=submit][value=draft]").click();
  await expect(page).toHaveURL(/tab=products/);
  const row = page.locator("tr").filter({ hasText: title });
  await row.locator("[data-action=edit-artist-product]").click();
  form = page.locator("[data-form=artist-edit]");
  await expect(form.locator(".design-studio")).toHaveAttribute(
    "data-ready",
    "true",
  );
  expect((await state(form)).placements).toEqual(before.placements);
  expect((await state(form)).artwork_id).toBe(original);
  await expect(form.locator("[name=category]")).toHaveValue("T-shirts");
  expect(errors).toEqual([]);
});
