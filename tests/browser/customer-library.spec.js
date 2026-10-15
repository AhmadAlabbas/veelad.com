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

test("bilingual text designs autosave, survive reload/offline recovery, appear in My Designs and print from immutable order snapshots", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(150000);
  const c = config();
  if (c.mode !== "local" || c.db.database !== "veelad_local")
    throw Error("Library fixtures require isolated local database");
  const db = database(c),
    stamp = info.project.name + "-" + Date.now(),
    pid = "p-words-" + stamp;
  let adminContext;
  try {
    await db.q("DELETE FROM rate_limits");
    const artist = (await db.one("SELECT id FROM artists ORDER BY id LIMIT 1"))
      .id;
    await db.q("INSERT INTO products VALUES (?,?,?,?,?,?)", [
      pid,
      artist,
      "active",
      20,
      JSON.stringify({
        title: "Your words " + stamp,
        title_ar: "كلماتك على قميص",
        category: "T-shirts",
        price: 7000,
        description: "Text design fixture",
        variants: ["Standard"],
        customer_customizable: true,
      }),
      new Date().toISOString(),
    ]);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/en/register?next=create");
    let form = page.locator("[data-form=register]");
    await form.locator("[name=name]").fill("Text designer");
    await form.locator("[name=email]").fill("words-" + stamp + "@example.test");
    await form.locator("[name=password]").fill("Library browser password 123");
    await form.locator("[type=submit]").click();
    await expect(page).toHaveURL(/\/en\/create/);
    form = page.locator("[data-form=customer-design]");
    await expect(form.locator(".design-studio")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await form.locator("[name=product_id]").selectOption(pid);
    await form.locator("[name=design_name]").fill("هدية أحمد / Ahmed gift");
    await form.locator("[data-text-add]").click();
    const mixed = "مرحبا Veelad";
    await form.locator("[data-text-prop=text]").fill(mixed);
    await form.locator("[data-text-prop=font]").selectOption("arabic-bold");
    await form.locator("[data-text-prop=color]").fill("#ba2038");
    await form.locator("[data-text-prop=y]").fill("40");
    await expect(form.locator(".studio-canvas-status")).not.toBeVisible();
    await expect(form.locator("[data-customer-save-status]")).toHaveText(
      "All changes saved",
      { timeout: 15000 },
    );
    await expect(page).toHaveURL(/draft=/);
    const draftId = new URL(page.url()).searchParams.get("draft");
    expect(draftId).toBeTruthy();
    await page.reload();
    await expect(form.locator(".design-studio")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(form.locator("[name=design_name]")).toHaveValue(
      "هدية أحمد / Ahmed gift",
    );
    await expect(form.locator("[data-text-prop=text]")).toHaveValue(mixed);
    await expect(form.locator("[data-text-prop=font]")).toHaveValue(
      "arabic-bold",
    );
    await expect(form.locator("[data-text-prop=color]")).toHaveValue("#ba2038");
    await expect(form.locator(".studio-canvas-status")).not.toBeVisible();
    await page.locator("[data-action=language-switch]").first().click();
    await expect(page).toHaveURL(/\/ar\/create/);
    await expect(form.locator(".design-studio")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(form.locator("[data-text-prop=text]")).toHaveValue(mixed);
    await expect(form.locator(".customer-text-tools h3")).toHaveText(
      "أضف كلماتك",
    );
    await expect(form.locator(".studio-canvas-status")).not.toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath("text-studio-ar.png"),
      fullPage: true,
    });
    await page.locator("[data-action=language-switch]").first().click();
    await expect(page).toHaveURL(/\/en\/create/);
    await expect(form.locator(".design-studio")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await form.locator("[data-text-add]").click();
    await form.locator("[data-text-prop=text]").fill("For Ahmed");
    await form.locator("[data-text-prop=font]").selectOption("manrope");
    await form.locator("[data-text-prop=y]").fill("70");
    await expect
      .poll(async () =>
        form.locator(".design-studio").getAttribute("data-text-busy"),
      )
      .not.toBe("true");
    await expect(form.locator(".studio-canvas-status")).not.toBeVisible();
    await expect(form.locator("[data-customer-save-status]")).toHaveText(
      "All changes saved",
      { timeout: 15000 },
    );
    await page.screenshot({
      path: info.outputPath("text-studio-en.png"),
      fullPage: true,
    });
    await form.locator("[name=rights]").check();
    await form.locator("[name=preview_accepted]").check();
    await form.locator("[type=submit]").click();
    await expect(page.locator("#modal")).toContainText(
      "Your design is in your bag.",
    );
    await expect(
      page.locator("#modal .product-photo.mockup img"),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Create another item with this artwork" })
      .click();
    await page
      .getByRole("link", { name: "My Designs", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/my-designs/);
    let card = page.locator(`[data-library-id="${draftId}"]`);
    await expect(card).toContainText("هدية أحمد / Ahmed gift");
    await expect(card.locator("img")).toBeVisible();
    await card.getByRole("link", { name: "Continue editing" }).click();
    await expect(form.locator(".design-studio")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(form.locator("[data-text-prop=text]")).toHaveValue(mixed);
    // A failed save keeps a device recovery copy. Reload restores it without overwriting server edits blindly.
    const blocked = async (route) =>
      route.request().method() === "POST" ? route.abort() : route.continue();
    await page.route("**/api.php?route=customer-draft", blocked);
    await page.route("**/api.php?route=customer-text-preview", blocked);
    await form.locator("[data-text-prop=text]").fill("Offline recovery مرحبا");
    await expect(form.locator("[data-customer-save-status]")).toContainText(
      "Could not sync",
      { timeout: 15000 },
    );
    await page.reload();
    await expect(form.locator(".design-studio")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(form.locator("[data-text-prop=text]")).toHaveValue(
      "Offline recovery مرحبا",
    );
    await page.unroute("**/api.php?route=customer-draft", blocked);
    await page.unroute("**/api.php?route=customer-text-preview", blocked);
    await page.evaluate(() => dispatchEvent(new Event("online")));
    await expect(form.locator(".studio-canvas-status")).not.toBeVisible({
      timeout: 15000,
    });
    await expect(form.locator("[data-customer-save-status]")).toHaveText(
      "All changes saved",
      { timeout: 15000 },
    );
    const row = await db.one(
      "SELECT data FROM customer_design_drafts WHERE id=?",
      [draftId],
    );
    expect(JSON.parse(row.data).design_studio.text_layers.shirt[0].text).toBe(
      "Offline recovery مرحبا",
    );
    const changeElsewhere = async (title) => {
      const current = await db.one(
          "SELECT data FROM customer_design_drafts WHERE id=?",
          [draftId],
        ),
        data = JSON.parse(current.data);
      data.title = title;
      await db.q(
        "UPDATE customer_design_drafts SET data=?,revision=revision+1 WHERE id=?",
        [JSON.stringify(data), draftId],
      );
    };
    await changeElsewhere("Other tab version");
    await form.locator("[name=design_name]").fill("Unsynced local version");
    await expect(form.locator("[data-customer-save-status]")).toContainText(
      "another tab",
      { timeout: 15000 },
    );
    await form.locator("[data-reload-customer-draft]").click();
    await page
      .locator("#modal [data-action=confirm-reload-customer-draft]")
      .click();
    await expect(form.locator(".design-studio")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(form.locator("[name=design_name]")).toHaveValue(
      "Other tab version",
    );
    await changeElsewhere("Other newer version");
    await form.locator("[name=design_name]").fill("Keep my copy");
    await expect(form.locator("[data-customer-save-status]")).toContainText(
      "another tab",
      { timeout: 15000 },
    );
    await form.locator("[data-copy-customer-draft]").click();
    await expect(form.locator("[data-customer-save-status]")).toHaveText(
      "All changes saved",
      { timeout: 15000 },
    );
    expect(new URL(page.url()).searchParams.get("draft")).not.toBe(draftId);
    expect(
      JSON.parse(
        (
          await db.one("SELECT data FROM customer_design_drafts WHERE id=?", [
            draftId,
          ])
        ).data,
      ).title,
    ).toBe("Other newer version");

    await page
      .getByRole("link", { name: "My Designs", exact: true })
      .first()
      .click();
    card = page.locator(`[data-library-id="${draftId}"]`);
    await card.getByRole("link", { name: "Make a copy" }).click();
    await expect(form.locator(".design-studio")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(form.locator("[data-customer-save-status]")).toHaveText(
      "All changes saved",
      { timeout: 15000 },
    );
    const copyId = new URL(page.url()).searchParams.get("draft");
    expect(copyId).not.toBe(draftId);
    await page
      .getByRole("link", { name: "My Designs", exact: true })
      .first()
      .click();
    const copy = page.locator(`[data-library-id="${copyId}"]`);
    await expect(copy).toBeVisible();
    await copy.getByRole("button", { name: "Remove from library" }).click();
    await page
      .locator("#modal [data-action=confirm-archive-customer-draft]")
      .click();
    await expect(page.locator(`[data-library-id="${copyId}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-library-id="${draftId}"]`)).toBeVisible();
    await page.goto("/en/bag");
    await expect(
      page.locator(".bag-item .product-photo.mockup img"),
    ).toBeVisible();
    await page.goto("/en/checkout");
    form = page.locator("[data-form=checkout]");
    for (const [name, value] of Object.entries({
      name: "Text customer",
      email: "words-" + stamp + "@example.test",
      address: "100 Example Street",
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
      ),
      item = last.order.items[0];
    expect(item.upload_id).toBeNull();
    expect(item.design_studio.text_layers.shirt.map((l) => l.text)).toEqual([
      mixed,
      "For Ahmed",
    ]);
    expect(last.order.payment_status).toBe("awaiting_payment");
    adminContext = await browser.newContext({ viewport: page.viewportSize() });
    const admin = await adminContext.newPage(),
      access = JSON.parse(await fs.readFile("var/local-admin.json", "utf8"));
    await admin.goto("/en/login");
    form = admin.locator("[data-form=login]");
    await form.locator("[name=email]").fill(access.email);
    await form.locator("[name=password]").fill(access.password);
    await form.locator("[type=submit]").click();
    await expect(admin).toHaveURL(/admin/);
    await admin.goto("/en/admin?tab=orders");
    await admin
      .locator(`[data-action=manage-order][data-id="${last.order.id}"]`)
      .click();
    const artworkDownload = admin.waitForEvent("download");
    await admin.locator("#modal [data-action=download-design-artwork]").click();
    const artwork = await artworkDownload,
      bytes = await fs.readFile(await artwork.path()),
      metadata = await sharp(bytes).metadata();
    expect(metadata.width).toBe(4500);
    expect(metadata.height).toBe(5400);
    expect(metadata.hasAlpha).toBe(true);
    const planDownload = admin.waitForEvent("download");
    await admin.locator("#modal [data-action=download-design-plan]").click();
    const plan = JSON.parse(
      await fs.readFile(await (await planDownload).path(), "utf8"),
    );
    expect(plan.products[0].text_layers[0].text).toBe(mixed);
    expect(plan.source_upload_id).toBeNull();
    expect(plan.supplier_confirmed).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    if (adminContext) await adminContext.close();
    await db.q("UPDATE products SET status='archived' WHERE id=?", [pid]);
    await db.pool.end();
  }
});
