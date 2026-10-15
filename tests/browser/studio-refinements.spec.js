import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { config } from "../../src/config.js";
import { database } from "../../src/db.js";
try {
  process.loadEnvFile(".env");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
test("artist checks artwork, nudges with undo and zoom, submits two independently reviewed listings and reuses the original", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const c = config();
  if (c.mode !== "local" || c.db.database !== "veelad_local")
    throw Error("Studio fixtures require isolated local database");
  const db = database(c),
    stamp = info.project.name + "-" + Date.now();
  try {
    await db.q("DELETE FROM rate_limits");
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/en/register");
    let form = page.locator("[data-form=register]");
    await form.locator("[name=name]").fill("Multi product artist");
    await form.locator("[name=email]").fill("multi-" + stamp + "@example.test");
    await form
      .locator("[name=password]")
      .fill("Artist refinements password 123");
    await form.locator("[name=role]").selectOption("artist");
    await form.locator("[type=submit]").click();
    await expect(page).toHaveURL(/studio/);
    await page.goto("/en/studio?tab=upload");
    form = page.locator("[data-form=artist-product]");
    await expect(form.locator(".design-studio")).toHaveAttribute(
      "data-ready",
      "true",
    );
    const title = "One original / " + stamp;
    await form.locator("[name=title]").fill(title);
    await form
      .locator("[name=description]")
      .fill("A design requested on a shirt and notebook.");
    await form.locator("#artwork-file").setInputFiles({
      name: "opaque.jpg",
      mimeType: "image/jpeg",
      buffer: await sharp({
        create: {
          width: 1000,
          height: 1200,
          channels: 3,
          background: "#a33c61",
        },
      })
        .jpeg()
        .toBuffer(),
    });
    await expect(form.locator("#upload-preview img")).toBeVisible();
    await expect(form.locator("[data-studio-warnings]")).toContainText(
      "opaque background",
    );
    await form.locator('[name=print_formats][value="Art prints"]').uncheck();
    await form.locator('[name=print_formats][value="T-shirts"]').check();
    await form.locator('[name=print_formats][value="Notebooks"]').check();
    await form.locator(".design-preview-format").selectOption("shirt");
    await form.locator("[name=category]").selectOption("T-shirts");
    const state = async () =>
      JSON.parse(await form.locator("[name=design_studio]").inputValue());
    await form.locator("[data-nudge=center]").click();
    const before = (await state()).placements.shirt.x;
    await form.locator("[data-nudge=right]").click();
    expect((await state()).placements.shirt.x).toBeCloseTo(before + 0.01);
    await form.locator("[data-studio-undo]").click();
    expect((await state()).placements.shirt.x).toBeCloseTo(before);
    await form.locator("[data-studio-redo]").click();
    expect((await state()).placements.shirt.x).toBeCloseTo(before + 0.01);
    const preserved = (await state()).placements.shirt;
    await form.locator("[data-studio-zoom]").selectOption("2");
    expect((await state()).placements.shirt).toEqual(preserved);
    const dimensions = await form
      .locator(".studio-canvas")
      .evaluate((node) => ({
        canvas: node.getBoundingClientRect().width,
        viewport: node.parentElement.getBoundingClientRect().width,
      }));
    expect(dimensions.canvas / dimensions.viewport).toBeCloseTo(2, 1);
    await form.locator("[data-studio-zoom]").selectOption("1");
    await form.locator("[data-placement=scale]").fill("200");
    await expect(form.locator("[data-studio-warnings]")).toContainText(
      "cropped",
    );
    await form.locator("[data-placement=scale]").fill("80");
    await form.locator("[name=create_products]").check();
    await form.locator("[name=rights]").check();
    await page.screenshot({
      path: info.outputPath("multi-product-studio.png"),
      fullPage: true,
    });
    await form.locator("[type=submit][value=submit]").click();
    await expect(page).toHaveURL(/tab=products/);
    const rows = page.locator("tbody tr").filter({ hasText: title });
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText("Pending");
    await rows.first().locator("[data-action=reuse-artist-design]").click();
    form = page.locator("#modal [data-form=artist-product]");
    await expect(form.locator("[name=upload_id]")).toHaveValue(/art-/);
    await expect(form.locator(".design-studio")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await form.locator("[name=title]").fill("Reused " + stamp);
    await form.locator("[name=rights]").check();
    await form.locator("[type=submit][value=submit]").click();
    await expect(page.locator("#modal")).not.toBeVisible();
    await expect(page.locator("tbody")).toContainText("Reused " + stamp);
    const user = (
        await db.one("SELECT id FROM users WHERE email=?", [
          "multi-" + stamp + "@example.test",
        ])
      ).id,
      items = await db.q("SELECT data,status FROM products WHERE artist_id=?", [
        user,
      ]);
    expect(items.length).toBe(3);
    expect(
      new Set(items.map((item) => JSON.parse(item.data).upload_id)).size,
    ).toBe(1);
    expect(items.every((item) => item.status === "pending")).toBe(true);
    expect(errors).toEqual([]);
    await page.goto("/ar/studio?tab=products");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  } finally {
    await db.pool.end();
  }
});
