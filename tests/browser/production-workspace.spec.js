import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { config } from "../../src/config.js";
import { database } from "../../src/db.js";
try {
  process.loadEnvFile(".env");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
test("customers review private proofs and administrators prepare production with bilingual mobile-safe controls", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120000);
  const c = config();
  if (c.mode !== "local" || c.db.database !== "veelad_local")
    throw Error("Production fixtures require isolated local database");
  const db = database(c),
    stamp = info.project.name + "-" + Date.now(),
    pid = "p-proof-ui-" + stamp;
  let adminContext;
  try {
    await db.q("DELETE FROM rate_limits");
    const artist = (await db.one("SELECT id FROM artists ORDER BY id LIMIT 1"))
      .id;
    const sourceId = "art-proof-ui-" + stamp,
      sourceName = sourceId + ".png";
    await fs.writeFile(
      path.join(c.uploadDir, sourceName),
      await sharp({
        create: { width: 400, height: 400, channels: 3, background: "#d4c5e8" },
      })
        .png()
        .toBuffer(),
      { mode: 0o600 },
    );
    await db.q("INSERT INTO uploads VALUES (?,?,?,?)", [
      sourceId,
      artist,
      sourceName,
      "image/png",
    ]);
    await db.q("INSERT INTO products VALUES (?,?,?,?,?,?)", [
      pid,
      artist,
      "active",
      10,
      JSON.stringify({
        title: "Proof workflow " + stamp,
        upload_id: sourceId,
        title_ar: "معاينة الإنتاج",
        category: "T-shirts",
        description: "Fixture",
        price: 7000,
        variants: ["Standard"],
      }),
      new Date().toISOString(),
    ]);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/en/register");
    let form = page.locator("[data-form=register]");
    await form.locator("[name=name]").fill("Proof customer");
    await form.locator("[name=email]").fill("proof-" + stamp + "@example.test");
    await form
      .locator("[name=password]")
      .fill("Production browser password 123");
    await form.locator("[type=submit]").click();
    await expect(page).toHaveURL(/account/);
    const result = await page.evaluate(async (pid) => {
        const b = await (await fetch("/api.php?route=bootstrap")).json();
        const r = await fetch("/api.php?route=checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": b.csrf,
          },
          body: JSON.stringify({
            customer: {
              name: "Proof customer",
              email: b.user.email,
              address: "100 Example Street",
              city: "Riyadh",
              postal: "12345",
              phone: "+966500000000",
              country: "Saudi Arabia",
            },
            cart: [{ id: pid, variant: "Standard", qty: 1 }],
            consent: true,
            request_key: "proof-ui-" + pid,
          }),
        });
        if (!r.ok) throw Error("Fixture checkout failed");
        return r.json();
      }, pid),
      oid = result.order.id;
    await page.goto("/en/track?id=" + oid);
    adminContext = await browser.newContext({ viewport: page.viewportSize() });
    const admin = await adminContext.newPage(),
      access = JSON.parse(await fs.readFile("var/local-admin.json", "utf8"));
    admin.on("pageerror", (error) => errors.push(error.message));
    await admin.goto("/en/login");
    form = admin.locator("[data-form=login]");
    await form.locator("[name=email]").fill(access.email);
    await form.locator("[name=password]").fill(access.password);
    await form.locator("[type=submit]").click();
    await expect(admin).toHaveURL(/admin/);
    await admin.goto("/en/admin?tab=production");
    await admin.locator(`[data-action=manage-order][data-id="${oid}"]`).click();
    form = admin.locator("[data-production-form=update]");
    await form.locator("[name=originals]").check();
    await form.locator("[name=placement]").check();
    await form.locator("[name=options]").check();
    await form.locator("[name=internal_notes]").fill("PRIVATE-SUPPLIER-PREP");
    await form
      .locator("[name=customer_note]")
      .fill("Your final preview is ready to review.");
    await form.locator("[type=submit],button:not([type])").click();
    await expect(admin.locator("#toast")).toHaveText(
      "Production progress saved.",
    );
    form = admin.locator("[data-production-form=proof]");
    await form.locator("[name=proof_file]").setInputFiles({
      name: "proof.png",
      mimeType: "image/png",
      buffer: await sharp({
        create: { width: 400, height: 400, channels: 3, background: "#ddd4ef" },
      })
        .png()
        .toBuffer(),
    });
    await form.locator("[name=caption]").fill("Check the front placement.");
    await form.locator("button").click();
    await expect(admin.locator("#toast")).toHaveText("Proof sent.");
    await page.reload();
    await expect(page.locator(".customer-production")).toContainText(
      "Check the front placement.",
    );
    await expect(page.locator(".customer-production")).not.toContainText(
      "PRIVATE-SUPPLIER-PREP",
    );
    await expect(page.locator(".proof-version img")).toBeVisible();
    form = page.locator("[data-production-form=response]");
    await form.locator("[name=feedback]").fill("Please move it lower.");
    await form.locator("[value=changes_requested]").click();
    await expect(page.locator(".proof-version")).toContainText(
      "Changes requested",
    );
    await admin.locator("#modal [data-action=close-modal]").click();
    await admin.reload();
    await admin.locator(`[data-action=manage-order][data-id="${oid}"]`).click();
    form = admin.locator("[data-production-form=proof]");
    await form.locator("[name=proof_file]").setInputFiles({
      name: "revised.png",
      mimeType: "image/png",
      buffer: await sharp({
        create: { width: 400, height: 400, channels: 3, background: "#bfd8d3" },
      })
        .png()
        .toBuffer(),
    });
    await form.locator("[name=caption]").fill("Revised front placement.");
    await form.locator("button").click();
    await expect(admin.locator("#toast")).toHaveText("Proof sent.");
    await page.reload();
    form = page.locator("[data-production-form=response]");
    await form.locator("[value=approved]").click();
    await expect(form.locator(".form-error")).toContainText("Confirm");
    await form.locator("[name=confirm]").check();
    await form.locator("[value=approved]").click();
    await expect(page.locator(".proof-version").last()).toContainText(
      "Proof approved",
    );
    await page.locator('[data-international-language]').first().selectOption(await page.locator('html').getAttribute('lang')==='ar'?'en':'ar');
    await expect(page).toHaveURL(/\/ar\/track/);
    await expect(page.locator(".customer-production")).toContainText(
      "تمت الموافقة على المعاينة",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath("customer-proof-ar.png"),
      fullPage: true,
    });
    await admin.locator("#modal [data-action=close-modal]").click();
    await admin.reload();
    await admin.locator(`[data-action=manage-order][data-id="${oid}"]`).click();
    form = admin.locator("[data-production-form=update]");
    await form.locator("[name=stage]").selectOption("ready");
    await form.locator("button").click();
    await expect(admin.locator("#toast")).toHaveText(
      "Production progress saved.",
    );
    form = admin.locator("[data-production-form=update]");
    await form.locator("[name=stage]").selectOption("printing");
    await form.locator("button").click();
    await expect(form.locator(".form-error")).toContainText(
      "Payment confirmation",
    );
    // Only the isolated fixture is marked paid; no external payments are enabled.
    const row = await db.one("SELECT data FROM orders WHERE id=?", [oid]),
      data = JSON.parse(row.data);
    data.payment_status = "paid";
    await db.q("UPDATE orders SET data=?,status=? WHERE id=?", [
      JSON.stringify(data),
      "processing",
      oid,
    ]);
    await form.locator("button").click();
    await expect(admin.locator("#toast")).toHaveText(
      "Production progress saved.",
    );
    await expect(admin.locator("[data-production-form=proof]")).toHaveCount(0);
    await admin.screenshot({
      path: info.outputPath("administrator-production.png"),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    if (adminContext) await adminContext.close();
    await db.q("UPDATE products SET status=? WHERE id=?", ["archived", pid]);
    await db.pool.end();
  }
});
