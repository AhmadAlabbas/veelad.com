import { test, expect } from "@playwright/test";
import { googleApp } from "../helpers/google-app.js";
try {
  process.loadEnvFile(".env");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
async function simulateGoogle(page, fixture, claims) {
  await page.route(
    "https://accounts.google.com/o/oauth2/v2/auth?**",
    async (route) => {
      const callback = fixture.provider.issue(route.request().url(), claims);
      await route.fulfill({
        status: 302,
        headers: { Location: callback.href },
        body: "",
      });
    },
  );
}
const pw = "Google browser password 123";
test("Google customer login keeps the guest bag, supports Arabic, sets a password and disconnects safely", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const fixture = await googleApp(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await simulateGoogle(page, fixture, {
      sub: "browser-customer",
      email: "browser-customer@example.test",
      name: "عميل Google",
    });
    await page.goto(fixture.origin + "/en/products/p1");
    await page.locator("[data-form=add-to-bag] [type=submit]").click();
    await page.locator("#modal [data-action=close-modal]").first().click();
    await page.goto(fixture.origin + "/ar/login?next=checkout");
    await expect(page.locator("[data-action=google-signin]")).toHaveText(
      "المتابعة باستخدام Google",
    );
    await page.locator("[data-action=google-signin]").click();
    await expect(page).toHaveURL(/\/ar\/checkout\?google=signed_in/);
    await expect(page.locator("[data-form=checkout]")).toBeVisible();
    await expect(page.locator(".summary-card")).toBeVisible();
    const state = await page.evaluate(async () => {
      const b = await (await fetch("/api.php?route=bootstrap")).json();
      return {
        user: b.user,
        cart: await (await fetch("/api.php?route=state")).json(),
      };
    });
    expect(state.user.email).toBe("browser-customer@example.test");
    expect(state.cart.cart[0].id).toBe("p1");
    expect(state.cart.cart[0].qty).toBe(1);
    await page.goto(fixture.origin + "/ar/account");
    await expect(page.locator(".google-account")).toContainText("Google متصل");
    await expect(
      page.locator(".google-account [data-google-form=disconnect]"),
    ).toHaveCount(0);
    await page.locator(".google-set-password summary").click();
    await page.locator(".google-set-password [name=password]").fill(pw);
    await page
      .locator(
        ".google-set-password [type=submit],.google-set-password form button",
      )
      .click();
    await expect(page.locator("[data-google-form=disconnect]")).toBeVisible();
    await page.screenshot({
      path: info.outputPath("google-account-ar.png"),
      fullPage: true,
    });
    const form = page.locator("[data-google-form=disconnect]");
    await form.locator("[name=password]").fill(pw);
    await form.locator("button").click();
    await expect(page.locator(".google-account")).toContainText("اربط حسابك بـ Google");
    await page.locator(".account-menu [data-action=logout]").click();
    await page.goto(fixture.origin + "/en/login");
    const login = page.locator("[data-form=login]");
    await login.locator("[name=email]").fill("browser-customer@example.test");
    await login.locator("[name=password]").fill(pw);
    await login.locator("[type=submit]").click();
    await expect(page).toHaveURL(/\/ar\/account/);
    expect(errors).toEqual([]);
  } finally {
    await page.goto("about:blank");
    await fixture.close();
  }
});
test("Google artist signup and existing-account connection preserve roles and reject silent email linking", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const fixture = await googleApp(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await simulateGoogle(page, fixture, {
      sub: "browser-artist",
      email: "browser-artist@example.test",
      name: "Google Artist",
    });
    await page.goto(fixture.origin + "/en/register");
    await page
      .locator("[data-form=register] [name=role]")
      .selectOption("artist");
    await page.screenshot({
      path: info.outputPath("google-register-en.png"),
      fullPage: true,
    });
    await page.locator("[data-action=google-signin]").click();
    await expect(page).toHaveURL(/\/en\/studio\?google=signed_in/);
    await expect(page.locator(".workspace-label")).toHaveText("Artist studio");
    await page.locator(".admin-topbar [data-action=logout]").click();
    await page.unroute("https://accounts.google.com/o/oauth2/v2/auth?**");
    await simulateGoogle(page, fixture, {
      sub: "existing-browser",
      email: "existing-browser@example.test",
      name: "Untrusted replacement name",
    });
    await page.goto(fixture.origin + "/en/register");
    let form = page.locator("[data-form=register]");
    await form.locator("[name=name]").fill("Existing owner");
    await form.locator("[name=email]").fill("existing-browser@example.test");
    await form.locator("[name=password]").fill(pw);
    await form.locator("[type=submit]").click();
    await expect(page).toHaveURL(/account/);
    const id = (
      await fixture.db.one("SELECT id FROM users WHERE email=?", [
        "existing-browser@example.test",
      ])
    ).id;
    await page.locator(".account-menu [data-action=logout]").click();
    await page.goto(fixture.origin + "/ar/login");
    await page.locator("[data-action=google-signin]").click();
    await expect(page).toHaveURL(/google=email_exists/);
    await expect(page.locator(".auth-form .notice")).toContainText(
      "يوجد حساب في فيلاد",
    );
    form = page.locator("[data-form=login]");
    await form.locator("[name=email]").fill("existing-browser@example.test");
    await form.locator("[name=password]").fill(pw);
    await form.locator("[type=submit]").click();
    await expect(page).toHaveURL(/account/);
    form = page.locator("[data-google-form=link]");
    await form.locator("[name=password]").fill("wrong password");
    await form.locator("button").click();
    await expect(form.locator(".google-error")).toContainText("كلمة المرور");
    await form.locator("[name=password]").fill(pw);
    await form.locator("button").click();
    await expect(page).toHaveURL(/google=connected/);
    await expect(page.locator(".google-account")).toContainText("Google متصل");
    const row = await fixture.db.one(
      "SELECT user_id FROM auth_identities WHERE subject=?",
      ["existing-browser"],
    );
    expect(row.user_id).toBe(id);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await page.goto("about:blank");
    await fixture.close();
  }
});
