/* Original, editable type compositions. Choosing a sample never changes a saved design. */
"use strict";
const customerStarters = [
  {
    id: "arabic-name", title: "A name, beautifully yours", group: "Arabic names", color: "#326453",
    fields: [{ key: "name", label: "Name on your item", en: "نورة", ar: "نورة", max: 24 }, { key: "line", label: "A little line below", en: "تفاصيل تشبهك", ar: "تفاصيل تشبهك", max: 44 }],
    lines: [{ text: "صُنع لك", y: .30, size: .038, font: "arabic" }, { field: "name", y: .49, size: .18, font: "arabic-bold" }, { field: "line", y: .69, size: .045, font: "arabic" }],
  },
  {
    id: "initials", title: "The everyday monogram", group: "Initials", color: "#493b72",
    fields: [{ key: "initials", label: "Your initials", en: "N · A", ar: "ن · ع", max: 8 }, { key: "name", label: "Name on your item", en: "NOURA ALI", ar: "نورة علي", max: 32 }],
    lines: [{ text: "—", y: .29, size: .07 }, { field: "initials", y: .46, size: .19, font: "manrope" }, { field: "name", y: .66, size: .045, font: "manrope" }],
  },
  {
    id: "birthday", title: "Another year of you", group: "Birthdays", color: "#b44738",
    fields: [{ key: "age", label: "Age or birthday number", en: "28", ar: "28", max: 4 }, { key: "name", label: "Birthday person's name", en: "NOURA", ar: "نورة", max: 24 }],
    lines: [{ en: "TODAY IS YOUR DAY", ar: "اليوم يومك", y: .25, size: .035 }, { field: "age", y: .46, size: .20, font: "manrope" }, { field: "name", y: .66, size: .06, font: "arabic-bold" }, { en: "MAKE IT A GOOD ONE", ar: "وعقبال أجمل السنين", y: .77, size: .032 }],
  },
  {
    id: "minimal-name", title: "Your daily signature", group: "Names", color: "#244c79",
    fields: [{ key: "name", label: "Name on your item", en: "Noura", ar: "نورة", max: 28 }, { key: "line", label: "A little line below", en: "A LITTLE MORE ME.", ar: "على ذوقي، كل يوم", max: 44 }],
    lines: [{ field: "name", y: .44, size: .15, font: "manrope" }, { text: "—", y: .60, size: .05 }, { field: "line", y: .70, size: .035 }],
  },
  {
    id: "gift-note", title: "A small gift. A big feeling.", group: "Gifts", color: "#9d4964",
    fields: [{ key: "to", label: "For someone special", en: "For Sara", ar: "لـ سارة", max: 28 }, { key: "message", label: "Your gift message", en: "YOU MAKE THE EVERYDAY LOVELY", ar: "معك، للأيام طعم ثاني", max: 54 }, { key: "from", label: "From you", en: "With love, Noura", ar: "بكل الحب، نورة", max: 32 }],
    lines: [{ field: "to", y: .32, size: .10, font: "arabic-bold" }, { field: "message", y: .51, size: .036 }, { text: "—", y: .64, size: .05 }, { field: "from", y: .75, size: .037 }],
  },
  {
    id: "coffee", title: "Coffee, with your name on it", group: "Small rituals", color: "#72523b",
    fields: [{ key: "name", label: "Coffee lover's name", en: "MOHAMMED", ar: "محمد", max: 24 }, { key: "line", label: "Their coffee mood", en: "SLOW MORNINGS. GOOD COFFEE.", ar: "قهوة على رواق", max: 44 }],
    lines: [{ en: "THE DAILY CUP OF", ar: "فنجان", y: .30, size: .035 }, { field: "name", y: .49, size: .13, font: "arabic-bold" }, { field: "line", y: .70, size: .035 }],
  },
  {
    id: "graduation", title: "Made it. Now, what's next?", group: "Milestones", color: "#336966",
    fields: [{ key: "year", label: "Graduation year", en: "2026", ar: "2026", max: 6 }, { key: "name", label: "Graduate's name", en: "NOURA", ar: "نورة", max: 28 }],
    lines: [{ en: "CLASS OF", ar: "دفعة", y: .29, size: .044 }, { field: "year", y: .48, size: .17, font: "manrope" }, { field: "name", y: .68, size: .055, font: "arabic-bold" }, { en: "THE NEXT CHAPTER IS YOURS", ar: "والجاي أجمل بإذن الله", y: .79, size: .03 }],
  },
  {
    id: "our-date", title: "Your people. Your day.", group: "Dates to keep", color: "#9a5b39",
    fields: [{ key: "names", label: "Names together", en: "NOURA & FAISAL", ar: "نورة وفيصل", max: 38 }, { key: "date", label: "A date to remember", en: "11 · 10 · 2026", ar: "11 · 10 · 2026", max: 26 }, { key: "line", label: "Your shared story", en: "OUR EVERYDAY STORY", ar: "ومن هنا تبدأ حكايتنا", max: 44 }],
    lines: [{ field: "names", y: .35, size: .075, font: "arabic-bold" }, { field: "date", y: .54, size: .058, font: "manrope", direction: "ltr" }, { field: "line", y: .72, size: .034 }],
  },
];
function customerStarterTemplates(draft) {
  const hasText = Object.values(draft?.design_studio?.text_layers || {}).some((layers) => layers.length);
  return `<details class="customer-starters" ${hasText ? "" : "open"}><summary><span><span class="eyebrow">${t("A STARTING POINT / YOUR FINISHING TOUCH")}</span><strong>${t("Start with a layout")}</strong><span>${t("Names, initials, birthdays and little gifts. Make one your own.")}</span></span><span class="starter-disclosure" aria-hidden="true">+</span></summary><div class="customer-starters-body"><p class="starter-intro">${t("Pick a layout, add your words, then apply it to your item. Every line stays editable.")}</p><div class="starter-grid" role="group" aria-label="${t("Starter layouts")}">${customerStarters.map((starter, index) => `<button type="button" class="starter-card" data-starter-select="${starter.id}" aria-pressed="${index === 0}"><span class="starter-art-frame" data-starter-miniature="${starter.id}" aria-hidden="true"></span><span class="starter-category">${t(starter.group)}</span><strong>${t(starter.title)}</strong></button>`).join("")}</div><section class="starter-personalize" aria-label="${t("Personalize your starter layout")}"><div data-starter-fields></div><div class="starter-apply"><p>${t("Your uploaded artwork and placements stay as they are. Only this item's text will change.")}</p><button type="button" class="btn" data-starter-apply disabled>${t("Use this layout")}</button></div><div class="starter-replace" data-starter-confirm hidden><p>${t("This item already has text. Replace its text with this layout? You can undo the change in the editor.")}</p><div><button type="button" class="btn sm" data-starter-replace>${t("Replace this item's text")}</button><button type="button" class="btn outline sm" data-starter-cancel>${t("Keep my design")}</button></div></div><p class="starter-status" data-starter-status role="status" aria-live="polite"></p></section><p class="starter-preview-note">${t("Flat layout samples. Review the actual product preview below; supplier measurements are still provisional.")}</p></div></details>`;
}
function starterDefaults(starter) {
  return Object.fromEntries(starter.fields.map((field) => [field.key, field[currentLanguage()]]));
}
function starterLayers(starter, values, product) {
  // The same composition fits a tall notebook and a shallow mug wrap without mirroring.
  const aspect = product.preview[1] / product.preview[0], scale = Math.min(1, aspect / .9);
  return starter.lines.map((line, index) => ({
    id: "starter-" + starter.id + "-" + index,
    text: line.field ? values[line.field] : line.text || line[currentLanguage()],
    font: line.font || (currentLanguage() === "ar" ? "arabic" : "manrope"),
    color: starter.color, x: .5, y: line.y, size: Math.max(.02, line.size * scale),
    rotation: 0, align: "center", direction: line.direction || "auto",
  }));
}
function starterInstance(root) {
  return studioInstances.get(root.closest("form")?.querySelector(".design-studio"));
}
function drawStarterMiniatures(root) {
  const instance = starterInstance(root);
  if (!instance?.state) return;
  const product = instance.product(), ratio = product.preview[0] / product.preview[1], state = root.starterState;
  for (const starter of customerStarters) {
    const values = state.values[starter.id] || starterDefaults(starter), layers = starterLayers(starter, values, product);
    root.querySelector(`[data-starter-miniature="${starter.id}"]`).innerHTML = `<span class="starter-paper" style="--starter-ratio:${ratio};--starter-width:${Math.min(100, ratio * 100)}%">${layers.map((layer) => `<span class="starter-line" dir="${layer.direction}" style="--starter-y:${layer.y * 100}%;--starter-size:${layer.size * 100};color:${layer.color};font-family:${/[\u0600-\u06ff]/u.test(layer.text) || layer.font.startsWith("arabic") ? "'Veelad Arabic'" : "Manrope"};font-weight:${layer.font === "arabic-bold" ? 700 : 400}">${esc(layer.text)}</span>`).join("")}</span>`;
  }
}
function starterStatus(root, message, error = false) {
  const status = root.querySelector("[data-starter-status]");
  status.textContent = t(message);
  status.dataset.error = String(error);
}
function selectStarter(root, starter) {
  const state = root.starterState;
  state.selected = starter.id;
  state.values[starter.id] ||= starterDefaults(starter);
  state.pending = null;
  state.serial++;
  root.querySelector("[data-starter-confirm]").hidden = true;
  for (const card of root.querySelectorAll("[data-starter-select]")) card.setAttribute("aria-pressed", String(card.dataset.starterSelect === starter.id));
  root.querySelector("[data-starter-fields]").innerHTML = `<div class="starter-edit-heading"><h3>${t(starter.title)}</h3><span>${t("Your words. Your layout.")}</span></div><div class="starter-fields-grid">${starter.fields.map((field) => `<label class="field">${t(field.label)}<input type="text" data-starter-field="${field.key}" value="${esc(state.values[starter.id][field.key])}" maxlength="${field.max}" autocomplete="off" dir="auto"></label>`).join("")}</div>`;
  starterStatus(root, "Preview only. Choose Use this layout when you are ready.");
  drawStarterMiniatures(root);
}
async function fitStarterLayers(layers, product) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await api("customer-text-preview", { category: product.category, layers });
    const glyphs = await Promise.all(result.layers.map(async (glyph) => {
      if (!glyph.image) return { id: glyph.id, image: null };
      const image = new Image(); image.src = glyph.image; await image.decode();
      return { id: glyph.id, image };
    }));
    let resized = false;
    for (const layer of layers) {
      const image = glyphs.find((item) => item.id === layer.id)?.image;
      if (!image) continue;
      const nearestRow = Math.min(...layers.filter((other) => other.id !== layer.id).map((other) => Math.abs(other.y - layer.y)));
      const availableHeight = 900 * product.preview[1] / product.preview[0] * Math.min(.15, nearestRow * .84);
      const fit = Math.min(1, 900 * .82 / image.naturalWidth, availableHeight / image.naturalHeight);
      if (fit >= 1) continue;
      if (attempt === 2 || layer.size * fit * .98 < .0199) throw Error(t("This text is too long for this layout. Shorten it, or use the text tools below."));
      layer.size = Math.max(.02, layer.size * fit * .98);
      resized = true;
    }
    if (!resized) return glyphs;
  }
}
async function applyStarter(root, replacing = false) {
  const state = root.starterState, instance = starterInstance(root), form = root.closest("form");
  if (!instance?.state || state.busy) return;
  const starter = customerStarters.find((item) => item.id === state.selected), values = state.values[starter.id], product = instance.product(), before = JSON.stringify(textLayersFor(instance));
  for (const field of root.querySelectorAll("[data-starter-field]")) {
    const value = field.value.trim();
    if (!value || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value)) {
      starterStatus(root, "Add your words using ordinary letters, numbers and punctuation.", true);
      field.setAttribute("aria-invalid", "true");
      field.focus();
      return;
    }
    values[field.dataset.starterField] = value;
  }
  if (textLayersFor(instance).length && !replacing) {
    state.pending = { product: product.id, before };
    root.querySelector("[data-starter-confirm]").hidden = false;
    starterStatus(root, "Your current design has not changed.");
    root.querySelector("[data-starter-replace]").focus({ preventScroll: true });
    return;
  }
  if (replacing && (state.pending?.product !== product.id || state.pending?.before !== before)) {
    root.querySelector("[data-starter-confirm]").hidden = true;
    state.pending = null;
    starterStatus(root, "Your design changed. Review it and choose Use this layout again.", true);
    return;
  }
  const serial = ++state.serial, sameState = instance.state, selectedProduct = form.elements.product_id.value, layers = starterLayers(starter, values, product).map((layer) => ({ ...layer, id: id("text-") }));
  state.busy = true;
  form.dataset.starterBusy = "true";
  root.setAttribute("aria-busy", "true");
  root.querySelector("[data-starter-apply]").disabled = true;
  root.querySelector("[data-starter-replace]").disabled = true;
  starterStatus(root, "Preparing your editable layout...");
  try {
    // Measure final server-shaped glyphs, including rounded font sizes, before changing anything.
    const glyphs = await fitStarterLayers(layers, product);
    if (!root.isConnected || state.serial !== serial) return;
    if (instance.state !== sameState || instance.product().id !== product.id || form.elements.product_id.value !== selectedProduct || JSON.stringify(textLayersFor(instance)) !== before) {
      starterStatus(root, "Your design changed. Review it and choose Use this layout again.", true);
      return;
    }
    instance.glyphCache ||= new Map();
    instance.glyphCache.set(textGlyphKey(layers), Promise.resolve(glyphs));
    while (instance.glyphCache.size > 12) instance.glyphCache.delete(instance.glyphCache.keys().next().value);
    instance.state.text_layers ||= {};
    instance.state.text_layers[product.id] = layers;
    instance.selectedText = layers.find((layer) => layer.text === values[starter.fields[0].key])?.id || layers[0].id;
    instance.textReadyKey = "";
    instance.customerTool = "text";
    instance.customerToolChosen = true;
    // Break input coalescing so applying a template is a complete undo step.
    instance.historyGroup = null;
    clearTimeout(instance.textTimer);
    instance.syncControls();
    instance.update();
    root.querySelector("[data-starter-confirm]").hidden = true;
    state.pending = null;
    form.elements.preview_accepted.checked = false;
    rememberCustomerDraft(form);
    state.appliedText = JSON.stringify(layers);
    state.appliedProduct = product.id;
    starterStatus(root, "Layout applied. Every line is editable in the text tools below.");
    form.querySelector(".design-studio").scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    form.querySelector("[data-text-prop=text]")?.focus({ preventScroll: true });
  } catch (error) {
    if (root.isConnected && state.serial === serial) starterStatus(root, error.message, true);
  } finally {
    state.busy = false;
    delete form.dataset.starterBusy;
    root.removeAttribute("aria-busy");
    root.querySelector("[data-starter-apply]").disabled = false;
    root.querySelector("[data-starter-replace]").disabled = false;
  }
}
function mountCustomerStarters(root) {
  if (root.starterState || !starterInstance(root)?.state) return;
  root.starterState = { selected: customerStarters[0].id, values: {}, serial: 0, pending: null, busy: false };
  selectStarter(root, customerStarters[0]);
  root.querySelector("[data-starter-apply]").disabled = false;
  root.addEventListener("input", (event) => {
    if (!event.target.matches("[data-starter-field]")) return;
    // These fields edit an unsaved sample, not the reviewed product or working draft.
    event.stopPropagation();
    event.target.removeAttribute("aria-invalid");
    const state = root.starterState;
    state.values[state.selected][event.target.dataset.starterField] = event.target.value;
    state.serial++;
    state.pending = null;
    root.querySelector("[data-starter-confirm]").hidden = true;
    starterStatus(root, "Preview only. Choose Use this layout when you are ready.");
    drawStarterMiniatures(root);
  });
  root.addEventListener("change", (event) => { if (event.target.matches("[data-starter-field]")) event.stopPropagation(); });
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !event.target.matches("[data-starter-field]")) return;
    event.preventDefault();
    event.stopPropagation();
    if (!root.starterState.busy) applyStarter(root);
  });
  root.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || root.starterState.busy) return;
    if (button.dataset.starterSelect) selectStarter(root, customerStarters.find((item) => item.id === button.dataset.starterSelect));
    else if (button.hasAttribute("data-starter-apply")) applyStarter(root);
    else if (button.hasAttribute("data-starter-replace")) applyStarter(root, true);
    else if (button.hasAttribute("data-starter-cancel")) {
      root.starterState.pending = null;
      root.querySelector("[data-starter-confirm]").hidden = true;
      starterStatus(root, "Your current design has not changed.");
      root.querySelector("[data-starter-apply]").focus({ preventScroll: true });
    }
  });
  root.closest("form").addEventListener("design-studio-change", () => {
    const state = root.starterState, current = starterInstance(root);
    if (state.appliedText && (state.appliedProduct !== current?.product().id || state.appliedText !== JSON.stringify(textLayersFor(current)))) {
      state.appliedText = null;
      starterStatus(root, "Your text has changed in the editor. Apply a layout again only if you want to replace it.");
    }
  });
  root.closest("form").addEventListener("change", (event) => {
    if (event.target.name !== "product_id") return;
    root.starterState.serial++;
    root.starterState.pending = null;
    root.querySelector("[data-starter-confirm]").hidden = true;
    // The customer product change handler runs later on document.
    queueMicrotask(() => drawStarterMiniatures(root));
  });
}
new MutationObserver(() => {
  const root = document.querySelector(".customer-starters");
  if (root) mountCustomerStarters(root);
}).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-ready"] });
