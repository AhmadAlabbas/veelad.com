import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { googleApp } from "../helpers/google-app.js";

try {
  process.loadEnvFile(".env");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

async function studioState(form) {
  return JSON.parse(await form.locator("[name=design_studio]").inputValue());
}

async function registerCreator(page, origin, email) {
  const bootstrap = await (
    await page.request.get(origin + "/api.php?route=bootstrap")
  ).json();
  const response = await page.request.post(origin + "/api.php?route=register", {
    headers: { "X-CSRF-Token": bootstrap.csrf },
    data: {
      name: "Workspace rehearsal creator",
      email,
      password: "Disposable workspace password 123",
    },
  });
  expect(response.ok()).toBe(true);
}

async function original(name, color) {
  return {
    name,
    mimeType: "image/png",
    buffer: await sharp({
      create: {
        width: 1200,
        height: 1500,
        channels: 4,
        background: color,
      },
    })
      .png()
      .toBuffer(),
  };
}

test("layered workspace keeps multiple originals and independent sides through editing, fonts, autosave and both languages", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "veelad-workspace-")),
    fixture = await googleApp({ uploadDir: folder }),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const cartRequests=[];
  page.on('request',request=>{
    if(request.method()==='POST'&&new URL(request.url()).searchParams.get('route')==='state'){
      const body=request.postDataJSON();if(Array.isArray(body?.cart))cartRequests.push(body.cart);
    }
  });
  try {
    const row = await fixture.db.one("SELECT data FROM products WHERE id=?", [
      "p1",
    ]);
    await fixture.db.q("UPDATE products SET data=? WHERE id=?", [
      JSON.stringify({
        ...JSON.parse(row.data),
        customer_customizable: true,
        sample_pricing: true,
        stock_is_simulated: true,
      }),
      "p1",
    ]);
    await registerCreator(
      page,
      fixture.origin,
      "workspace-" + info.project.name + "@example.test",
    );
    await page.goto(fixture.origin + "/en/create?product=p1");
    const form = page.locator("[data-form=customer-design]"),
      shell = form.locator(".customer-workspace"),
      scene = async (surface) => (await studioState(form)).scenes.shirt[surface];
    await expect(form.locator(".design-studio")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(shell).toBeVisible();
    await expect(form.locator('.studio-upload')).not.toBeVisible();
    await expect(shell.locator('[data-ws-drop]')).toBeVisible();
    await expect(shell).toHaveAttribute("data-surface", "front");
    await form.locator("[name=design_name]").fill("A little of both worlds");

    // The two files remain distinct private originals, rather than replacing one another.
    const red = await original("front-coral.png", "#dc594ddd"),
      teal = await original("front-teal.png", "#157d82bb"),
      blue = await original("back-blue.png", "#384bbaee");
    await shell.locator("[data-ws-upload]").setInputFiles([red, teal]);
    await expect
      .poll(async () => (await scene("front")).layers.filter((l) => l.type === "image").length)
      .toBe(2);
    const firstImages = (await scene("front")).layers.filter(
      (layer) => layer.type === "image",
    );
    expect(new Set(firstImages.map((layer) => layer.upload_id)).size).toBe(2);
    const selectedImage = firstImages[1];
    await shell.locator("[data-ws-tool=layers]").click();
    await shell.locator(`[data-ws-select="${selectedImage.id}"]`).click();
    await shell.locator("[data-ws-prop=opacity]").fill("55");
    await shell.locator("[data-ws-prop=opacity]").press("Tab");
    await expect
      .poll(async () => (await scene("front")).layers.find((l) => l.id === selectedImage.id).opacity)
      .toBe(0.55);

    // A complete layer operation is reversible without affecting the uploaded originals.
    await shell.locator("[data-ws-action=duplicate]").click();
    await expect.poll(async () => (await scene("front")).layers.length).toBe(3);
    await shell.locator("[data-ws-action=undo]").click();
    await expect.poll(async () => (await scene("front")).layers.length).toBe(2);
    await shell.locator("[data-ws-action=redo]").click();
    await expect.poll(async () => (await scene("front")).layers.length).toBe(3);
    await shell.locator("[data-ws-action=undo]").click();
    await expect.poll(async () => (await scene("front")).layers.length).toBe(2);
    await shell.locator(`[data-ws-select="${selectedImage.id}"]`).click();
    const xBefore = (await scene("front")).layers.find((l) => l.id === selectedImage.id).x;
    await shell.locator("[data-ws-artboard]").focus();
    await shell.locator("[data-ws-artboard]").press("ArrowRight");
    await expect
      .poll(async () => (await scene("front")).layers.find((l) => l.id === selectedImage.id).x)
      .toBeGreaterThan(xBefore);

    // Pointer manipulation uses the visible artboard, including touch-sized handles on phones.
    if (await shell.locator("[data-ws-close-panel]").isVisible())
      await shell.locator("[data-ws-close-panel]").click();
    const object = shell.locator(`[data-ws-layer="${selectedImage.id}"]`);
    await object.scrollIntoViewIfNeeded();
    const position = await object.boundingBox();
    const xDragged = (await scene("front")).layers.find((l) => l.id === selectedImage.id).x;
    await page.mouse.move(position.x + position.width / 2, position.y + position.height / 2);
    await page.mouse.down();
    await page.mouse.move(position.x + position.width / 2 + 18, position.y + position.height / 2 - 12, { steps: 5 });
    await page.mouse.up();
    await expect
      .poll(async () => (await scene("front")).layers.find((l) => l.id === selectedImage.id).x)
      .toBeGreaterThan(xDragged);
    const widthBefore = (await scene("front")).layers.find((l) => l.id === selectedImage.id).width;
    const resize = shell.locator("[data-ws-handle=se]");
    await resize.scrollIntoViewIfNeeded();
    await resize.hover();
    const handle = await resize.boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 + 20, handle.y + handle.height / 2 + 20, { steps: 5 });
    await page.mouse.up();
    await expect
      .poll(async () => (await scene("front")).layers.find((l) => l.id === selectedImage.id).width)
      .toBeGreaterThan(widthBefore);

    // Font browsing selects real local fonts from different scripts; text survives shaping and saving.
    await shell.locator("[data-ws-tool=text]").click();
    await shell.locator("[data-ws-add-text=body]").first().click();
    await shell.locator("[data-ws-prop=text]").fill("أفكار تصير حقيقة");
    await shell.locator("[data-ws-tool=fonts]").click();
    await shell.locator("[data-ws-font-script]").selectOption("Arab");
    await shell.locator("[data-ws-font-search]").fill("Amiri");
    await shell.locator("[data-ws-font=amiri]").click();
    await expect
      .poll(async () => (await scene("front")).layers.filter((l) => l.type === "text")[0]?.font)
      .toBe("amiri");
    await shell.locator("[data-ws-tool=text]").click();
    await shell.locator("[data-ws-add-text=body]").first().click();
    await shell.locator("[data-ws-prop=text]").fill("創造する楽しさ");
    await shell.locator("[data-ws-tool=fonts]").click();
    await shell.locator("[data-ws-font-script]").selectOption("Jpan");
    await shell.locator("[data-ws-font-search]").fill("Noto Sans JP");
    await shell.locator("[data-ws-font=noto-sans-jp]").click();
    await expect
      .poll(async () => (await scene("front")).layers.filter((l) => l.type === "text")[1]?.font)
      .toBe("noto-sans-jp");
    expect(
      await page.evaluate(async () => {
        await window.VeeladFonts.ready;
        return window.VeeladFonts.catalogue().length;
      }),
    ).toBeGreaterThanOrEqual(100);
    const front = await scene("front");
    await shell.screenshot({ path: info.outputPath("layered-workspace-en.png") });

    await shell.locator("[data-ws-surface=back]").click();
    await expect(shell).toHaveAttribute("data-surface", "back");
    await expect.poll(async () => (await scene("back")).layers.length).toBe(0);
    await shell.locator("[data-ws-tool=uploads]").click();
    await shell.locator("[data-ws-upload]").setInputFiles(blue);
    await expect
      .poll(async () => (await scene("back")).layers.filter((l) => l.type === "image").length)
      .toBe(1);
    const back = await scene("back");
    expect(back.layers[0].upload_id).not.toBe(firstImages[0].upload_id);
    expect(await scene("front")).toEqual(front);
    await expect(form.locator("[data-customer-save-status]")).toHaveText(
      "All changes saved",
      { timeout: 20000 },
    );
    await expect(page).toHaveURL(/draft=/);
    const draftId = new URL(page.url()).searchParams.get("draft");
    const stored = JSON.parse(
      (await fixture.db.one("SELECT data FROM customer_design_drafts WHERE id=?", [draftId])).data,
    );
    expect(stored.design_studio.scenes.shirt.front).toMatchObject(front);
    expect(stored.design_studio.scenes.shirt.back).toMatchObject(back);

    await page.reload();
    await expect(form.locator(".design-studio")).toHaveAttribute("data-ready", "true");
    await expect(shell).toHaveAttribute("data-surface", "back");
    expect(await scene("front")).toMatchObject(front);
    expect(await scene("back")).toMatchObject(back);
    await shell.locator("[data-ws-surface=front]").click();
    await expect(shell.locator("[data-ws-layer]")).toHaveCount(4);
    await page.locator("[data-action=language-switch]").first().click();
    await expect(page).toHaveURL(/\/ar\/create/);
    await expect(form.locator(".design-studio")).toHaveAttribute("data-ready", "true");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(shell).toBeVisible();
    expect(await scene("front")).toMatchObject(front);
    expect(await scene("back")).toMatchObject(back);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
    await shell.screenshot({ path: info.outputPath("layered-workspace-ar.png") });

    // The UI hands every side and every original to the immutable bag design.
    await form.locator("[name=rights]").check();
    await form.locator("[name=preview_accepted]").check();
    const savedResponse = page.waitForResponse(
      (response) => response.url().includes("route=customer-design") && response.request().method() === "POST",
    );
    await form.locator("[data-customer-order]").click();
    const response = await savedResponse;
    expect(response.ok()).toBe(true);
    const saved = await response.json();
    expect(saved.customization.design_studio.scenes.shirt.front).toMatchObject(front);
    expect(saved.customization.design_studio.scenes.shirt.back).toMatchObject(back);
    expect(new Set(saved.customization.source_upload_ids)).toEqual(
      new Set([...firstImages, ...back.layers].map((layer) => layer.upload_id)),
    );
    await expect(page.locator("#modal")).toBeVisible();
    expect(cartRequests.some(lines=>lines.some(line=>line.customization_id===saved.customization_id))).toBe(true);
    for(const lines of cartRequests)for(const line of lines){expect(line).not.toHaveProperty('customization');expect(line).not.toHaveProperty('design_studio');}
    await page.locator('#modal [data-action=close-modal]').click();

    // Copying between print sides protects an existing design and is undoable.
    await shell.locator('[data-ws-surface=back]').click();
    await shell.locator('[data-ws-copy-side]').click();
    await expect(shell.locator('[data-ws-copy-confirm]')).toBeVisible();
    await shell.locator('[data-ws-cancel-copy]').click();
    expect(await scene('back')).toMatchObject(back);
    await shell.locator('[data-ws-copy-side]').click();
    await shell.locator('[data-ws-confirm-copy]').click();
    await expect.poll(async () => (await scene('back')).layers.length).toBe(front.layers.length);
    expect((await scene('back')).layers.map(layer => layer.id)).not.toEqual(front.layers.map(layer => layer.id));
    await shell.locator('[data-ws-action=undo]').click();
    expect(await scene('back')).toMatchObject(back);

    // Focus mode leaves a usable canvas on a phone and cleans up on navigation.
    await shell.locator('[data-ws-focus]').click();
    await expect(page.locator('body')).toHaveClass(/has-studio-focus/);
    expect(await shell.locator('.cw-panel-content').evaluate(node=>node.getBoundingClientRect().height)).toBeGreaterThan(100);
    await shell.screenshot({ path: info.outputPath('layered-workspace-focus.png') });
    await shell.locator('[data-ws-artboard]').focus();
    await shell.locator('[data-ws-artboard]').press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/has-studio-focus/);
    await shell.locator('[data-ws-focus]').click();
    await page.evaluate(() => go('shop'));
    await expect(page).toHaveURL(/\/ar\/shop/);
    await expect(page.locator('body')).not.toHaveClass(/has-studio-focus/);
    expect(errors).toEqual([]);
  } finally {
    await page.goto("about:blank").catch(() => {});
    await fixture.close();
    await fs.rm(folder, { recursive: true, force: true });
  }
});
