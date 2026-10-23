import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { config } from "../../src/config.js";
import { database } from "../../src/db.js";
try { process.loadEnvFile(".env"); } catch (error) { if (error.code !== "ENOENT") throw error; }

const sceneText = (state, type) => (state.scenes[type]?.[type === "mug" ? "wrap" : "front"]?.layers || []).filter((layer) => layer.type === "text");

test("starter layouts stay editable, protect existing artwork and text, autosave, and survive language changes", async ({ page }, info) => {
  test.setTimeout(120000);
  const c = config();
  if (c.mode !== "local" || c.db.database !== "veelad_local") throw Error("Starter fixtures require the isolated local database");
  const db = database(c), stamp = info.project.name + "-" + Date.now(), shirt = "starter-shirt-" + stamp, mug = "starter-mug-" + stamp;
  const errors = [], designRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (request.method() === "POST" && request.url().includes("route=customer-design")) designRequests.push(request.url()); });
  const studio = () => page.locator("[data-form=customer-design]"),
    state = () => studio().locator("[name=design_studio]").evaluate((node) => JSON.parse(node.value)),
    starters = () => page.locator(".customer-starters"),
    settled = async () => {
      await expect(starters().locator("[data-starter-status]")).toHaveText("Layout applied. Every line is editable in the text tools below.");
      await expect(studio().locator(".design-studio")).not.toHaveAttribute("data-text-busy", "true");
      await expect(studio().locator(".studio-canvas-status")).not.toBeVisible();
    };
  try {
    await db.q("DELETE FROM rate_limits");
    const artist = (await db.one("SELECT id FROM artists ORDER BY id LIMIT 1")).id;
    for (const [id, category] of [[shirt, "T-shirts"], [mug, "Mugs"]]) await db.q("INSERT INTO products VALUES (?,?,?,?,?,?)", [id, artist, "active", 15, JSON.stringify({ title: "Starter " + category + " " + stamp, title_ar: category === "Mugs" ? "كوب على ذوقك" : "تيشيرت على ذوقك", category, price: 7000, description: "Local starter fixture", variants: ["Standard"], customer_customizable: true }), new Date().toISOString()]);
    await page.goto("/en/register?next=create");
    const register = page.locator("[data-form=register]");
    await register.locator("[name=name]").fill("Starter creator");
    await register.locator("[name=email]").fill("starter-" + stamp + "@example.test");
    await register.locator("[name=password]").fill("Editable starter browser 123");
    await register.locator("[type=submit]").click();
    await expect(page).toHaveURL(/\/en\/create/);
    await expect(studio().locator(".design-studio")).toHaveAttribute("data-ready", "true");
    await studio().locator("[data-ws-tool=layouts]").click();
    await expect(starters().locator("[data-starter-select]")).toHaveCount(8);
    await page.evaluate(() => document.fonts.ready);
    const miniatureOverflow = await starters().locator(".starter-line").evaluateAll((lines) => lines.filter((line) => {
      const sample = line.closest(".starter-paper").getBoundingClientRect(), bounds = line.getBoundingClientRect();
      return bounds.left < sample.left - 1 || bounds.right > sample.right + 1 || bounds.top < sample.top - 1 || bounds.bottom > sample.bottom + 1;
    }).map((line) => line.textContent));
    expect(miniatureOverflow).toEqual([]);
    await starters().screenshot({ path: info.outputPath("starter-layouts-en-detail.png") });
    await studio().locator("[name=design_name]").fill("A real editable starter");

    // Keep an independent mug layout while working on the shirt.
    await studio().locator("[name=product_id]").selectOption(mug);
    await starters().locator("[data-starter-select=initials]").click();
    await starters().locator("[data-starter-field=initials]").fill("س · ر");
    await starters().locator("[data-starter-field=name]").fill("سارة راشد");
    await starters().locator("[data-starter-apply]").click();
    await settled();
    const mugText = sceneText(await state(), "mug");
    await studio().locator("[name=product_id]").selectOption(shirt);
    await studio().locator("[data-ws-tool=uploads]").click();
    await studio().locator("[data-ws-upload]").setInputFiles({ name: "private-original.png", mimeType: "image/png", buffer: await sharp({ create: { width: 1200, height: 1400, channels: 4, background: "#c7dcda" } }).png().toBuffer() });
    await expect(studio().locator("[name=upload_id]")).not.toHaveValue("");
    await expect(studio().locator(".design-studio")).not.toHaveAttribute("data-text-busy", "true");
    const source = await studio().locator("[name=upload_id]").inputValue();
    await expect.poll(async () => (await state()).artwork_id).toBe(source);
    const before = await state();
    await studio().locator("[data-ws-tool=layouts]").click();

    await starters().locator("[data-starter-select=arabic-name]").click();
    await studio().locator("[name=rights]").check();
    await studio().locator("[name=preview_accepted]").check();
    await starters().locator("[data-starter-field=name]").fill("");
    await starters().locator("[data-starter-apply]").click();
    await expect(starters().locator("[data-starter-status]")).toHaveAttribute("data-error", "true");
    // A rejected, un-applied sample must never poison the order form's validity.
    expect(await studio().evaluate((form) => form.checkValidity())).toBe(true);
    expect(await state()).toEqual(before);
    await starters().locator("[data-starter-field=name]").fill("عبدالعزيز");
    await starters().locator("[data-starter-field=line]").fill("تفاصيل على ذوقي");
    await expect(studio().locator("[name=preview_accepted]")).toBeChecked();
    expect(await state()).toEqual(before);
    // Enter in a quick field applies the sample; it cannot submit the surrounding order form.
    await starters().locator("[data-starter-field=name]").press("Enter");
    await settled();
    expect(designRequests).toEqual([]);
    const applied = await state();
    expect(sceneText(applied, "shirt").map((layer) => layer.text)).toEqual(["صُنع لك", "عبدالعزيز", "تفاصيل على ذوقي"]);
    expect(sceneText(applied, "mug")).toEqual(mugText);
    expect(applied.placements).toEqual(before.placements);
    expect(applied.artwork_id).toBe(source);
    await expect(studio().locator("[name=preview_accepted]")).not.toBeChecked();
    await expect(studio().locator("[data-ws-prop=text]")).toHaveValue("عبدالعزيز");
    await studio().locator("[data-ws-prop=text]").fill("عبدالعزيز سعود");
    await expect(studio().locator("[data-customer-save-status]")).toHaveText("All changes saved", { timeout: 15000 });
    const edited = await state();

    await starters().locator("[data-starter-select=birthday]").click();
    await starters().locator("[data-starter-apply]").click();
    await expect(starters().locator("[data-starter-confirm]")).toBeVisible();
    expect(await state()).toEqual(edited);
    await starters().locator("[data-starter-cancel]").click();
    expect(await state()).toEqual(edited);

    // Old accepted content cannot be submitted while the replacement is being shaped.
    await studio().locator("[name=preview_accepted]").check();
    await starters().locator("[data-starter-apply]").click();
    let releasePreview, intercepted = false;
    const previewGate = new Promise((resolve) => { releasePreview = resolve; });
    await page.route("**/api.php?route=customer-text-preview", async (route) => { intercepted = true; await previewGate; await route.continue(); });
    await starters().locator("[data-starter-replace]").click();
    await expect.poll(() => intercepted).toBe(true);
    await studio().locator("[data-customer-order]").click();
    await expect(page.locator("#toast")).toHaveText("Wait for your starter layout to finish before adding this item to your bag.");
    expect(designRequests).toEqual([]);
    releasePreview();
    await settled();
    await page.unroute("**/api.php?route=customer-text-preview");
    await studio().locator("[data-ws-action=undo]").click();
    expect(sceneText(await state(), "shirt")).toEqual(sceneText(edited, "shirt"));
    expect(sceneText(await state(), "mug")).toEqual(mugText);
    expect((await state()).artwork_id).toBe(source);
    await expect(studio().locator("[data-customer-save-status]")).toHaveText("All changes saved", { timeout: 15000 });
    await page.reload();
    await expect(studio().locator(".design-studio")).toHaveAttribute("data-ready", "true");
    expect((await state()).scenes).toEqual(edited.scenes);
    await page.locator("[data-action=language-switch]").first().click();
    await expect(page).toHaveURL(/\/ar\/create/);
    await expect(studio().locator(".design-studio")).toHaveAttribute("data-ready", "true");
    expect((await state()).scenes).toEqual(edited.scenes);
    await studio().locator("[data-ws-tool=layouts]").click();
    await expect(starters().locator("summary strong")).toHaveText("ابدأ بفكرة جاهزة");
    const savedState = await state();
    for (const key of ["arabic-name", "initials", "birthday", "minimal-name", "gift-note", "coffee", "graduation", "our-date"]) {
      await starters().locator(`[data-starter-select="${key}"]`).click();
      await expect(starters().locator(`[data-starter-select="${key}"]`)).toHaveAttribute("aria-pressed", "true");
      expect(await state()).toEqual(savedState);
    }
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await starters().scrollIntoViewIfNeeded();
    await starters().screenshot({ path: info.outputPath("starter-layouts-ar-detail.png") });
    await page.screenshot({ path: info.outputPath("starter-layouts-ar.png"), fullPage: true });
    if (info.project.name === "mobile") {
      await page.setViewportSize({ width: 320, height: 740 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    expect(designRequests).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await db.q("UPDATE products SET status='archived' WHERE id IN (?,?)", [shirt, mug]);
    await db.pool.end();
  }
});
