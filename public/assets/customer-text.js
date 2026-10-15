/* Text glyphs are shaped by the same bundled fonts used for production exports. */
"use strict";
function textLayersFor(instance) {
  return instance.state.text_layers?.[instance.product().id] || [];
}
function textGlyphKey(layers) {
  return JSON.stringify(
    layers.map(({ id, text, font, color, size, align, direction }) => ({
      id,
      text,
      font,
      color,
      size,
      align,
      direction,
    })),
  );
}
async function customerTextOverlay(instance, product) {
  const layers = instance.state.text_layers?.[product.id] || [];
  if (!layers.some((layer) => layer.text.trim())) {
    delete instance.root.dataset.textBusy;
    instance.textReadyKey = textGlyphKey(layers);
    return null;
  }
  const key = textGlyphKey(layers);
  instance.glyphCache ||= new Map();
  if (!instance.glyphCache.has(key)) {
    instance.root.dataset.textBusy = "true";
    const work = (async () => {
      const data = await api("customer-text-preview", {
        category: product.category,
        layers,
      });
      return Promise.all(
        data.layers.map(async (layer) => {
          if (!layer.image) return { ...layer, image: null };
          const image = new Image();
          image.src = layer.image;
          await image.decode();
          return { id: layer.id, image };
        }),
      );
    })();
    instance.glyphCache.set(key, work);
    while (instance.glyphCache.size > 12)
      instance.glyphCache.delete(instance.glyphCache.keys().next().value);
    work.catch(() => instance.glyphCache.delete(key));
  }
  try {
    const glyphs = await instance.glyphCache.get(key),
      canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = Math.round((900 * product.preview[1]) / product.preview[0]);
    const ctx = canvas.getContext("2d");
    for (const layer of layers) {
      const image = glyphs.find((g) => g.id === layer.id)?.image;
      if (!image) continue;
      ctx.save();
      ctx.translate(layer.x * canvas.width, layer.y * canvas.height);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
      ctx.restore();
    }
    if (textGlyphKey(textLayersFor(instance)) === key) {
      instance.textReadyKey = key;
      delete instance.root.dataset.textBusy;
    }
    return canvas;
  } catch (error) {
    delete instance.root.dataset.textBusy;
    throw error;
  }
}
function mountCustomerTextTools(instance) {
  const root = instance.root;
  if (!root.closest("[data-form=customer-design]")) return;
  const aside = root.querySelector(".studio-controls"),
    art = document.createElement("div");
  art.className = "customer-artwork-controls";
  while (aside.firstChild) art.append(aside.firstChild);
  aside.append(art);
  aside.insertAdjacentHTML(
    "afterbegin",
    `<div class="customer-edit-tabs" role="tablist" aria-label="${t("Editing tools")}"><button type="button" role="tab" data-customer-tool="artwork">${t("Artwork")}</button><button type="button" role="tab" data-customer-tool="text">${t("Text")}</button></div>`,
  );
  aside.insertAdjacentHTML(
    "beforeend",
    `<section class="customer-text-tools" aria-label="${t("Text tools")}"><div class="section-title"><div><h3>${t("Add your words")}</h3><p>${t("Write in Arabic, English, or both. Up to four layers and 120 characters per layer.")}</p></div><button type="button" class="btn outline sm" data-text-add>${t("Add text")}</button></div><div class="text-layer-tabs" data-text-layers></div><div data-text-editor hidden><label class="field">${t("Your text")}<textarea data-text-prop="text" rows="3" maxlength="120" dir="auto" placeholder="${t("Make it personal...")}"></textarea></label><div class="text-controls-grid"><label class="field">${t("Font")}<select data-text-prop="font"><option value="arabic">${t("Veelad Arabic")}</option><option value="arabic-bold">${t("Veelad Arabic Bold")}</option><option value="manrope">Manrope</option><option value="dm-sans">DM Sans</option></select></label><label class="field">${t("Text color")}<input type="color" data-text-prop="color" value="#171717"></label><label class="field">${t("Text size (%)")}<input type="range" data-text-prop="size" min="2" max="20" step="0.5" dir="ltr"></label><label class="field">${t("Text rotation")}<input type="range" data-text-prop="rotation" min="-180" max="180" step="1" dir="ltr"></label><label class="field">${t("Text horizontal position (%)")}<input type="number" data-text-prop="x" min="0" max="100" step="1" dir="ltr"></label><label class="field">${t("Text vertical position (%)")}<input type="number" data-text-prop="y" min="0" max="100" step="1" dir="ltr"></label><label class="field">${t("Text alignment")}<select data-text-prop="align"><option value="left">${t("Left")}</option><option value="center">${t("Center")}</option><option value="right">${t("Right")}</option></select></label><label class="field">${t("Writing direction")}<select data-text-prop="direction"><option value="auto">${t("Automatic")}</option><option value="rtl">${t("Right to left")}</option><option value="ltr">${t("Left to right")}</option></select></label></div><div class="text-layer-actions"><label class="check"><input type="checkbox" data-text-drag>${t("Drag selected text on the preview")}</label><button type="button" class="text-link" data-text-duplicate>${t("Duplicate text")}</button><button type="button" class="text-link" data-text-remove>${t("Remove text")}</button></div><p class="small">${t("Arabic lettering uses Veelad Arabic when a Latin font is selected. The printing file includes your text; the uploaded original remains unchanged.")}</p></div></section>`,
  );
  root.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const type = instance.product().id;
    instance.state.text_layers ||= {};
    instance.state.text_layers[type] ||= [];
    const layers = instance.state.text_layers[type];
    if (button.dataset.customerTool) {
      instance.customerTool = button.dataset.customerTool;
      instance.customerToolChosen = true;
      syncCustomerTextTools(instance);
      return;
    }
    if (
      button.hasAttribute("data-text-add") ||
      button.hasAttribute("data-text-duplicate")
    ) {
      if (layers.length >= 4) {
        toast(t("Add up to four text layers per product."));
        return;
      }
      const previous = button.hasAttribute("data-text-duplicate")
        ? layers.find((layer) => layer.id === instance.selectedText)
        : null;
      const layer = {
        text: "",
        font: "arabic",
        color: "#171717",
        x: 0.5,
        y: 0.5,
        size: 0.08,
        rotation: 0,
        align: "center",
        direction: "auto",
        ...(previous || {}),
        id: id("text-"),
      };
      layers.push(layer);
      instance.selectedText = layer.id;
      instance.customerTool = "text";
      instance.customerToolChosen = true;
    } else if (button.dataset.textSelect)
      instance.selectedText = button.dataset.textSelect;
    else if (button.hasAttribute("data-text-remove"))
      instance.state.text_layers[type] = layers.filter(
        (layer) => layer.id !== instance.selectedText,
      );
    else return;
    syncCustomerTextTools(instance);
    instance.update();
    root.querySelector("[data-text-prop=text]")?.focus();
  });
  root.addEventListener("input", (event) => {
    const key = event.target.dataset.textProp;
    if (!key) return;
    const layer = textLayersFor(instance).find(
      (layer) => layer.id === instance.selectedText,
    );
    if (!layer) return;
    if (["text", "font", "color", "align", "direction"].includes(key))
      layer[key] = event.target.value;
    else {
      const value = Number(event.target.value);
      if (!Number.isFinite(value)) return;
      layer[key] =
        key === "size"
          ? Math.max(0.02, Math.min(0.2, value / 100))
          : key === "rotation"
            ? Math.max(-180, Math.min(180, value))
            : Math.max(0, Math.min(1, value / 100));
    }
    instance.persist();
    clearTimeout(instance.textTimer);
    instance.textTimer = setTimeout(
      () => instance.update(),
      ["text", "size", "font", "color"].includes(key) ? 350 : 0,
    );
  });
  syncCustomerTextTools(instance);
}
function syncCustomerTextTools(instance) {
  const root = instance.root,
    tools = root.querySelector(".customer-text-tools");
  if (!tools) return;
  const layers = textLayersFor(instance);
  const tool = instance.customerToolChosen
    ? instance.customerTool
    : layers.length || !instance.image
      ? "text"
      : "artwork";
  root.querySelector(".customer-artwork-controls").hidden = tool !== "artwork";
  tools.hidden = tool !== "text";
  for (const tab of root.querySelectorAll("[data-customer-tool]"))
    tab.setAttribute(
      "aria-selected",
      String(tab.dataset.customerTool === tool),
    );
  if (!layers.some((layer) => layer.id === instance.selectedText))
    instance.selectedText = layers[0]?.id;
  const key =
    instance.product().id +
    "|" +
    layers.map((layer) => layer.id).join(",") +
    "|" +
    instance.selectedText;
  if (tools.dataset.layers !== key) {
    tools.dataset.layers = key;
    tools.querySelector("[data-text-layers]").innerHTML = layers
      .map(
        (layer, index) =>
          `<button type="button" class="btn outline sm" data-text-select="${esc(layer.id)}" aria-pressed="${layer.id === instance.selectedText}">${t("Text {number}", { number: localNumber(index + 1) })}</button>`,
      )
      .join("");
  }
  tools.querySelector("[data-text-editor]").hidden = !layers.length;
  tools.querySelector("[data-text-add]").disabled = layers.length >= 4;
  const layer = layers.find((layer) => layer.id === instance.selectedText);
  if (!layer) return;
  for (const field of tools.querySelectorAll("[data-text-prop]"))
    if (document.activeElement !== field) {
      const key = field.dataset.textProp;
      field.value = ["size", "x", "y"].includes(key)
        ? Math.round(layer[key] * 1000) / 10
        : layer[key];
    }
}
function customerDragTarget(instance) {
  return instance.root.querySelector("[data-text-drag]")?.checked
    ? textLayersFor(instance).find(
        (layer) => layer.id === instance.selectedText,
      )
    : null;
}

document.addEventListener("click", (event) => {
  const start = event.target.closest("[data-start-with-text]");
  if (!start) return;
  const root = start.closest("form").querySelector(".design-studio"),
    instance = studioInstances.get(root);
  if (!instance) return;
  instance.customerTool = "text";
  instance.customerToolChosen = true;
  syncCustomerTextTools(instance);
  if (!textLayersFor(instance).length)
    root.querySelector("[data-text-add]").click();
  root
    .querySelector(".customer-text-tools")
    .scrollIntoView({
      block: "center",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  root.querySelector("[data-text-prop=text]")?.focus({ preventScroll: true });
});
