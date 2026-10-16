import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import sharp from "sharp";
import { config } from "../../src/config.js";
import { database } from "../../src/db.js";
try {
  process.loadEnvFile(".env");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}

test("customers customize two products with one private original, switch language, order, and admin downloads the matching files", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120000);
  const c = config();
  if (c.mode !== "local" || c.db.database !== "veelad_local")
    throw Error("Customer fixtures require the isolated local database");
  const db = database(c),
    stamp = info.project.name + "-" + Date.now(),
    shirtId = "custom-shirt-" + stamp,
    notebookId = "custom-book-" + stamp;
  let adminContext;
  try {
    await db.q("DELETE FROM rate_limits");
    const artist = (await db.one("SELECT id FROM artists ORDER BY id LIMIT 1"))
      .id;
    for (const [id, category, enabled, price, variants] of [
      [shirtId, "T-shirts", false, 8500, ["S", "M"]],
      [notebookId, "Notebooks", true, 4500, ["Standard"]],
    ]) {
      await db.q("INSERT INTO products VALUES (?,?,?,?,?,?)", [
        id,
        artist,
        "active",
        20,
        JSON.stringify({
          title: "Personal " + category + " " + stamp,
          title_ar: category === "T-shirts" ? "قميصك الشخصي" : "دفترك الشخصي",
          category,
          price,
          description: "A blank item for your own artwork.",
          variants,
          customer_customizable: enabled,
        }),
        new Date().toISOString(),
      ]);
    }
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    adminContext = await browser.newContext({ viewport: page.viewportSize() });
    const admin = await adminContext.newPage();
    const access = JSON.parse(
      await fs.readFile("var/local-admin.json", "utf8"),
    );
    await admin.goto("/en/login");
    let form = admin.locator("[data-form=login]");
    await form.locator("[name=email]").fill(access.email);
    await form.locator("[name=password]").fill(access.password);
    await form.locator("[type=submit]").click();
    await expect(admin).toHaveURL(/admin/);
    await admin.goto("/en/admin?tab=products");
    await admin
      .locator(`tr [data-action=edit-product][data-id="${shirtId}"]`)
      .click();
    form = admin.locator("[data-form=admin-product]");
    await expect(
      form.locator("[name=customer_customizable]"),
    ).not.toBeChecked();
    await form.locator("[name=customer_customizable]").check();
    await form.locator("[type=submit]").click();
    await expect(admin.locator("#modal")).not.toBeVisible();
    expect(
      JSON.parse(
        (await db.one("SELECT data FROM products WHERE id=?", [shirtId])).data,
      ).customer_customizable,
    ).toBe(true);

    await page.goto("/en/create");
    await expect(page.locator("h1")).toHaveText("Your idea. Your everyday.");
    await expect(page.locator("#artwork-file")).toHaveCount(0);
    await page.locator('main a[href="/en/register?next=create"]').click();
    form = page.locator("[data-form=register]");
    await form.locator("[name=name]").fill("Personal creator");
    await form
      .locator("[name=email]")
      .fill("custom-" + stamp + "@example.test");
    await form.locator("[name=password]").fill("Customer studio password 123");
    await form.locator("[type=submit]").click();
    await expect(page).toHaveURL(/\/en\/create$/);
    form = page.locator("[data-form=customer-design]");
    await expect(form.locator(".design-studio")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await form.locator("[name=product_id]").selectOption(shirtId);
    await form.locator("[name=variant]").selectOption("M");
    await expect(form.locator(".design-mockup")).toHaveAttribute(
      "data-format",
      "shirt",
    );
    await expect(form.locator(".studio-products")).not.toBeVisible();
    const original = await sharp({
      create: {
        width: 2400,
        height: 3000,
        channels: 4,
        background: { r: 40, g: 100, b: 170, alpha: 0.85 },
      },
    })
      .png()
      .toBuffer();
    await form.locator("#artwork-file").setInputFiles({
      name: "personal-original.png",
      mimeType: "image/png",
      buffer: original,
    });
    await expect(form.locator("#upload-status")).toContainText("Artwork ready");
    await expect
      .poll(
        async () =>
          JSON.parse(await form.locator("[name=design_studio]").inputValue())
            .artwork_id,
      )
      .toMatch(/^art-/);
    await expect(form.locator("[data-artwork-metadata]")).toContainText(
      "2,400",
    );
    await form.locator("[data-placement=rotation]").fill("13");
    await form.locator("[data-placement=rotation]").dispatchEvent("input");
    await page.locator("[data-action=language-switch]").first().click();
    await expect(page).toHaveURL(/\/ar\/create/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(form.locator(".studio-upload-note")).toContainText(
      "استخدم PNG شفافًا",
    );
    await expect(form.locator("[data-artwork-metadata]")).toContainText(
      "الملف الأصلي",
    );
    await expect(form.locator("#upload-status")).toContainText(
      "يبقى التصميم الحالي",
    );
    await expect(form.locator("[name=product_id]")).toHaveValue(shirtId);
    await expect(form.locator("[name=variant]")).toHaveValue("M");
    await expect(form.locator(".design-studio")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(form.locator("[data-placement=rotation]")).toHaveValue("13");
    await expect(form.locator(".studio-canvas-status")).not.toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath("customer-studio-ar.png"),
      fullPage: true,
    });
    await page.locator("[data-action=language-switch]").first().click();
    await expect(page).toHaveURL(/\/en\/create/);
    await expect(form.locator(".design-studio")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(form.locator("[data-placement=rotation]")).toHaveValue("13");
    await expect(form.locator(".studio-canvas-status")).not.toBeVisible();
    await page.screenshot({
      path: info.outputPath("customer-studio-en.png"),
      fullPage: true,
    });
    await form.locator("[name=rights]").check();
    await form.locator("[name=preview_accepted]").check();
    await form.locator("[type=submit]").click();
    await expect(page.locator("#modal")).toBeVisible();
    await expect(page.locator("#modal")).toContainText(
      "Your design is in your bag.",
    );
    await page
      .getByRole("button", { name: "Create another item with this artwork" })
      .click();
    await form.locator("[name=product_id]").selectOption(notebookId);
    await expect(form.locator(".design-mockup")).toHaveAttribute(
      "data-format",
      "notebook",
    );
    await expect(form.locator("[name=preview_accepted]")).not.toBeChecked();
    await expect(form.locator("#upload-preview img")).toBeVisible();
    await form.locator("[name=preview_accepted]").check();
    const reviewedState = await form.locator("[name=design_studio]").inputValue();
    await page.evaluate(() => refreshArtworkMetadata(uploadId));
    await expect(form.locator("[name=design_studio]")).toHaveValue(reviewedState);
    await expect(form.locator("[name=preview_accepted]")).toBeChecked();
    await form.locator("[data-placement=rotation]").fill("7");
    await form.locator("[data-placement=rotation]").dispatchEvent("input");
    await expect(form.locator("[name=preview_accepted]")).not.toBeChecked();
    await form.locator("[name=preview_accepted]").check();
    await form.locator("[type=submit]").click();
    await expect(page.locator("#modal")).toBeVisible();
    await expect(page.locator("#modal")).toContainText(
      "Your design is in your bag.",
    );
    await page.locator('#modal a[href="/en/bag"]').click();
    await expect(page.locator(".bag-item")).toHaveCount(2);
    await expect(page.locator(".bag-item .product-photo.mockup")).toHaveCount(
      2,
    );
    await expect(page.locator(".bag-item").first()).toContainText(
      "Your personal design",
    );
    await page.reload();
    await expect(page.locator(".bag-item")).toHaveCount(2);
    await page
      .locator(".bag-item")
      .filter({ hasText: "Personal T-shirts" })
      .getByRole("link", { name: "Edit design" })
      .click();
    await expect(page).toHaveURL(/create.*design=/);
    form = page.locator("[data-form=customer-design]");
    await expect(form.locator(".design-studio")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(form.locator("[data-placement=rotation]")).toHaveValue("13");
    await form.locator("[name=preview_accepted]").check();
    await form.locator("[type=submit]").click();
    await expect(page.locator("#modal")).toBeVisible();
    await page.locator('#modal a[href="/en/bag"]').click();
    await expect(page.locator(".bag-item")).toHaveCount(2);
    await expect(
      page.locator(".bag-item").first().locator(".cart-quantity"),
    ).toHaveText("1");
    const images = await page
      .locator(".bag-item img")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("src")));
    for (const src of images) {
      const response = await page.request.get(src);
      expect(response.status()).toBe(200);
    }
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.goto("/en/checkout");
    form = page.locator("[data-form=checkout]");
    for (const [name, value] of Object.entries({
      name: "Custom creator",
      email: "custom-" + stamp + "@example.test",
      address: "100 Test Street",
      city: "Riyadh",
      postal: "12345",
      phone: "+966500000000",
    }))
      await form.locator(`[name="${name}"]`).fill(value);
    await form.locator("[name=consent]").check();
    await page.locator("button[form=checkout-form]").click();
    await expect(page).toHaveURL(/confirmation/);
    const last = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("veelad-v2-last-order")),
    );
    expect(last.order.items).toHaveLength(2);
    expect(last.order.subtotal).toBe(13000);
    expect(last.order.payment_status).toBe("awaiting_payment");
    expect(last.order.items[0].upload_id).toBe(last.order.items[1].upload_id);
    expect(
      last.order.items.every(
        (item) =>
          item.customer_customized &&
          item.royalty_percent === 0 &&
          item.artist_id === null,
      ),
    ).toBe(true);
    const stranger = await browser.newContext();
    try {
      for (const src of images)
        expect(
          (await stranger.request.get("http://127.0.0.1:3000" + src)).status(),
        ).toBe(404);
    } finally {
      await stranger.close();
    }
    await admin.goto("/en/admin?tab=orders");
    await admin
      .locator(`[data-action=manage-order][data-id="${last.order.id}"]`)
      .click();
    await expect(admin.locator("#modal")).toContainText(
      "Customer-designed item",
    );
    const sourceDownload = admin.waitForEvent("download");
    await admin
      .locator("#modal [data-action=download-production-file]")
      .first()
      .click();
    const file = await sourceDownload;
    expect(await fs.readFile(await file.path())).toEqual(original);
    const planDownload = admin.waitForEvent("download");
    await admin
      .locator(
        `#modal [data-action=download-design-plan][data-line="${last.order.items.find((item) => item.id === shirtId).line_id}"]`,
      )
      .click();
    const plan = JSON.parse(
      await fs.readFile(await (await planDownload).path(), "utf8"),
    );
    expect(plan.products[0].placement.rotation).toBe(13);
    expect(plan.customer_customized).toBe(true);
    expect(plan.variant).toBe("M");
    expect(plan.source_upload_id).toBe(last.order.items[0].upload_id);
    expect(errors).toEqual([]);
  } finally {
    if (adminContext) await adminContext.close();
    await db.q("UPDATE products SET status='archived' WHERE id IN (?,?)", [
      shirtId,
      notebookId,
    ]);
    await db.pool.end();
  }
});
