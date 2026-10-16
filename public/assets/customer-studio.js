/* Customer-owned designs reuse the production studio without becoming public listings. */
"use strict";
let customerDraft = null;
function customerCustomizationField(p) {
  return `<section class="notice"><label class="check"><input type="checkbox" name="customer_customizable" ${p?.customer_customizable ? "checked" : ""}><strong>${t("Allow customers to create their own design on this product")}</strong></label><p class="small">${t("Customers use a blank preview and their own artwork. This product’s price, stock and options apply. Personal designs do not earn an artist royalty or appear in the public catalog. Enable only products you can print and fulfill.")}</p></section>`;
}
function customizableProducts() {
  return products.filter(
    (p) => p.customer_customizable === true && p.stock > 0,
  );
}
function customerCreatePage() {
  const available = customerEditorProducts();
  const intro = `<div class="page-title customer-create-intro"><span class="eyebrow">${t("MADE BY YOU / PRINTED BY VEELAD")}</span><h1>${t("Your idea. Your everyday.")}</h1><p>${t("Make a one-off gift or something just for you. Add your artwork, find its perfect placement, and we’ll print and ship your item after your order is confirmed.")}</p><ol class="customer-steps"><li>${t("Choose your item")}</li><li>${t("Make it yours")}</li><li>${t("Review and order")}</li></ol></div>`;
  if (mode === "demo")
    return `<main id="main" class="container customer-create">${intro}${empty(t("Personal designs use your secure account."), t("Open the connected store to create and order a private design."), link(t("Back to store"), "home", "btn"))}</main>`;
  if (!available.length)
    return `<main id="main" class="container customer-create">${intro}${empty(t("Custom items are coming soon."), t("We’re preparing the products available for your own designs. Please check back shortly."), user?.role === "admin" ? link(t("Set up customizable products"), "admin", "btn", { tab: "products" }) : link(t("Browse designs"), "shop", "btn"))}</main>`;
  if (!user)
    return `<main id="main" class="container customer-create">${intro}<div class="customer-blank-grid">${available.map((p) => `<article><img src="/assets/mockups/${studioTypes.find((type) => type[1] === p.category)?.[0] || "print"}.webp" alt="${esc(t(p.category))}"><h3>${esc(localField(p, "title"))}</h3><p>${money(p.price)}</p></article>`).join("")}</div><section class="notice"><h2>${t("Keep your creativity private.")}</h2><p>${t("Sign in or create an account to upload your artwork and save your personal item in your bag.")}</p><div class="stack">${link(t("Sign in"), "login", "btn", { next: "create" })}${link(t("Create account"), "register", "btn outline", { next: "create" })}</div></section></main>`;
  if (customerDraft?.user_id !== user.id) customerDraft = null;
  const editing = cart.find(
    (line) =>
      line.customization_id === params.get("design") && line.customization,
  );
  if (editing && customerDraft?.editing_key !== editing.key)
    customerDraft = {
      ...editing.customization,
      user_id: user.id,
      product_id: editing.id,
      variant: editing.variant,
      rights: true,
      editing_key: editing.key,
    };
  const p =
    available.find((p) => p.id === params.get("product")) ||
    available.find((p) => p.id === customerDraft?.product_id) ||
    available[0];
  const draft = customerDraft
    ? {
        upload_id: customerDraft.upload_id,
        design_studio: customerDraft.design_studio,
        category: p.category,
      }
    : { category: p.category };
  uploadId = draft.upload_id || null;
  return `<main id="main" class="container customer-create">${intro}<form data-form="customer-design"><section class="customer-draft-bar">${field(t("Design name"), "design_name", customerDraft?.title || "", "text", 'maxlength="80" dir="auto"')}<div class="customer-draft-actions"><span role="status" aria-live="polite" data-customer-save-status>${t(customerDraft?.conflict ? "This draft changed in another tab. Reload it or save a copy." : "Your progress saves automatically")}</span><div><button type="button" class="btn outline sm" data-save-customer-draft>${t("Save draft now")}</button><button type="button" class="text-link" data-copy-customer-draft>${t("Save a copy")}</button><button type="button" class="text-link" data-reload-customer-draft ${customerDraft?.conflict ? "" : "hidden"}>${t("Reload saved version")}</button>${link(t("My Designs"), "my-designs", "text-link")}</div></div></section><section class="customer-product-choice"><label class="field">${t("Choose your item")}<select name="product_id" required>${available.map((item) => `<option value="${esc(item.id)}" ${item.id === p.id ? "selected" : ""}>${esc(t(item.category))} — ${esc(localField(item, "title"))} · ${money(item.price)}</option>`).join("")}</select></label><input type="hidden" name="category" value="${esc(p.category)}"><input type="hidden" name="upload_id" value="${esc(draft.upload_id || "")}"><label class="field">${t("Choose an option")}<select name="variant" required>${p.variants.map((v) => `<option value="${esc(v)}" ${customerDraft?.variant === v ? "selected" : ""}>${esc(localVariant(p, v))}</option>`).join("")}</select></label><div class="customer-price"><span>${t("Per item")}</span><strong data-customer-price>${money(p.price)}</strong></div></section>${customerStarterTemplates(draft)}${designArtworkUpload(draft).replace(t("Start with your best original."), t("Upload artwork or start with text.")).replace(t("Your original stays private until the listing is approved."), t("Your artwork is private. Only you and the Veelad production team can access it."))}<p class="small customer-text-hint">${t("Artwork is optional. You can design with text only.")} <button type="button" class="text-link" data-start-with-text>${t("Start with text")}</button></p>${button(t("Remove uploaded artwork"), "remove-customer-artwork", "", "text-link")}${designPlacementPreview(draft)}<section class="customer-review"><p class="notice" data-customer-unavailable hidden>${t("This product is unavailable for ordering. You can keep editing your draft or choose another item.")}</p><div><span class="eyebrow">${t("03 / REVIEW YOUR ITEM")}</span><h2>${t("Ready to make it real?")}</h2><p>${t("Check the product, option, crop and placement. This is a provisional visual preview; our team must confirm the printable area and quality before production.")}</p></div><label class="check"><input type="checkbox" name="rights" required ${customerDraft?.rights ? "checked" : ""}>${t("I own this artwork or have permission to print it.")}</label><label class="check"><input type="checkbox" name="preview_accepted" required>${t("I reviewed my design and understand the preview is provisional.")}</label><div class="customer-submit"><p>${t("Delivery is calculated in your bag. No payment is collected online.")}</p><button type="submit" class="btn" data-customer-order>${t("Save design and add to bag")} ${icon("bag")}</button></div></section></form></main>`;
}
function rememberCustomerDraft(form) {
  if (!form || !user || !form.isConnected) return;
  let studio;
  try {
    studio = JSON.parse(form.querySelector("[name=design_studio]").value);
  } catch {}
  customerDraft = {
    ...(customerDraft || {}),
    title: form.elements.design_name.value,
    user_id: user.id,
    product_id: form.elements.product_id.value,
    variant: form.elements.variant.value,
    upload_id: uploadId || form.elements.upload_id.value || null,
    design_studio: studio,
    rights: form.elements.rights.checked,
    editing_key: customerDraft?.editing_key || null,
  };
  const remove = form.querySelector("[data-action=remove-customer-artwork]");
  if (remove) remove.hidden = !customerDraft.upload_id;
  queueCustomerAutosave();
}
function syncCustomerProduct(form) {
  if (!form) return;
  const p = customerEditorProducts().find(
    (p) => p.id === form.elements.product_id.value,
  );
  if (!p) return;
  const root = form.querySelector(".design-studio"),
    instance = studioInstances.get(root),
    type = studioTypes.find((type) => type[1] === p.category);
  form.elements.category.value = p.category;
  const variant = form.elements.variant,
    previous = variant.value;
  variant.innerHTML = p.variants
    .map(
      (v) =>
        `<option value="${esc(v)}" ${previous === v ? "selected" : ""}>${esc(localVariant(p, v))}</option>`,
    )
    .join("");
  form.querySelector("[data-customer-price]").textContent = money(p.price);
  if (instance?.state) {
    instance.state.active_product = type[0];
    instance.syncControls();
    instance.update();
  } else root.dataset.category = p.category;
  root.querySelector(".design-preview-format").disabled = true;
  // The customer selects a real purchasable product above, not a requested seller format.
  root.querySelector(".studio-heading h3").textContent = t("Make it yours");
  root.querySelector(".studio-heading p").textContent = t(
    "Move, resize, rotate or repeat your artwork. Your original file stays unchanged.",
  );
  form.querySelector("#upload-status").textContent = t(
    form.elements.upload_id.value
      ? "Existing artwork retained until replaced."
      : "Your artwork is private. Only you and the Veelad production team can access it.",
  );
  form.querySelector("[data-customer-unavailable]").hidden =
    customizableProducts().some((item) => item.id === p.id);
  form.querySelector("[data-customer-order]").disabled =
    !customizableProducts().some((item) => item.id === p.id);
  rememberCustomerDraft(form);
}
async function submitCustomerDesign(form, v) {
  if (form.dataset.starterBusy)
    throw Error(t("Wait for your starter layout to finish before adding this item to your bag."));
  if (form.dataset.artworkBusy)
    throw Error(t("Wait for your images to finish uploading."));
  if (!user) throw Error(t("Please sign in to continue."));
  const p = customizableProducts().find((p) => p.id === v.product_id);
  if (!p) throw Error(t("Choose an available customizable product."));
  if (!p.variants.includes(v.variant)) throw Error(t("Choose a valid option."));
  const editing = cart.find((line) => line.key === customerDraft?.editing_key),
    quantity = editing?.qty || 1,
    others = cart.filter((line) => line.key !== editing?.key);
  if (
    others
      .filter((line) => line.id === p.id)
      .reduce((sum, line) => sum + line.qty, 0) +
      quantity >
    p.stock
  )
    throw Error(t("You’ve reached the available quantity."));
  const root = form.querySelector(".design-studio"),
    instance = studioInstances.get(root),
    source = uploadId || v.upload_id;
  if (!instance?.state)
    throw Error(t("Preview templates could not be loaded."));
  if (!source && !textLayersFor(instance).some((layer) => layer.text.trim()))
    throw Error(t("Add artwork or text to your design."));
  if (
    instance.root.dataset.textBusy ||
    (textLayersFor(instance).some((layer) => layer.text.trim()) &&
      instance.textReadyKey !== textGlyphKey(textLayersFor(instance)))
  )
    throw Error(t("Wait for the text preview to finish."));
  if (!instance?.state)
    throw Error(t("Preview templates could not be loaded."));
  instance.state.artwork_id = source || null;
  instance.persist();
  rememberCustomerDraft(form);
  await flushCustomerDraft();
  const result = await api("customer-design", {
    title: form.elements.design_name.value,
    product_id: p.id,
    upload_id: source || null,
    design_studio: JSON.parse(form.elements.design_studio.value),
    rights: !!v.rights,
    preview_accepted: !!v.preview_accepted,
  });
  const key = p.id + "::" + v.variant + "::" + result.customization_id,
    next = clone(others),
    existing = next.find((line) => line.key === key);
  if (existing) {
    if (existing.qty + quantity > 20)
      throw Error(t("You’ve reached the available quantity."));
    existing.qty += quantity;
  } else
    next.push({
      id: p.id,
      key,
      variant: v.variant,
      qty: quantity,
      customization_id: result.customization_id,
      customization: result.customization,
    });
  await stateQueue;
  await api("state", { cart: next });
  cart = next;
  write("cart", cart);
  rememberCustomerDraft(form);
  customerDraft.editing_key = null;
  if (params.has("design")) {
    params.delete("design");
    history.replaceState(
      null,
      "",
      normalUrl("create", Object.fromEntries(params)),
    );
  }
  // Refresh the navigation count while keeping the editor and upload available for a second product.
  document
    .querySelectorAll(".nav-actions .count")
    .forEach(
      (node) =>
        (node.textContent = localNumber(
          cart.reduce((sum, line) => sum + line.qty, 0),
        )),
    );
  openModal(
    t("Your design is in your bag."),
    `${photo({ ...p, ...result.customization })}<p>${t("Your personal design")} · ${esc(t(p.category))} · ${esc(localVariant(p, v.variant))}</p><strong>${money(p.price)}</strong><div class="stack">${link(t("View bag & checkout"), "bag", "btn full")}${button(t("Create another item with this artwork"), "close-modal", "", "btn outline full")}</div>`,
  );
}
document.addEventListener("change", (event) => {
  const form = event.target.closest("[data-form=customer-design]");
  if (!form) return;
  if (event.target.name === "product_id") {
    syncCustomerProduct(form);
    form.elements.preview_accepted.checked = false;
  }
  rememberCustomerDraft(form);
});
document.addEventListener("input", (event) => {
  const form = event.target.closest("[data-form=customer-design]");
  if (!form) return;
  if (!["rights", "preview_accepted"].includes(event.target.name))
    form.elements.preview_accepted.checked = false;
  rememberCustomerDraft(form);
});
document.addEventListener("design-studio-change", (event) => {
  const form = event.target.closest("[data-form=customer-design]");
  if (!form) return;
  form.elements.preview_accepted.checked = false;
  rememberCustomerDraft(form);
});
// The shared editor initializes asynchronously after the page is mounted.
new MutationObserver(() => {
  const form = document.querySelector("[data-form=customer-design]");
  if (
    form?.querySelector(".design-studio")?.dataset.ready === "true" &&
    !form.dataset.customerReady
  ) {
    form.dataset.customerReady = "true";
    syncCustomerProduct(form);
  }
}).observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ["data-ready"],
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-action=remove-customer-artwork]")) return;
  const form = event.target.closest("[data-form=customer-design]");
  if (!form) return;
  uploadId = null;
  form.elements.upload_id.value = "";
  form.querySelector("#upload-preview").innerHTML = icon("upload");
  const root = form.querySelector(".design-studio"),
    instance = studioInstances.get(root);
  root.dataset.source = "";
  root.dataset.artworkId = "";
  if (instance) {
    instance.image = null;
    instance.source = null;
    instance.metadata = null;
    instance.state.artwork_id = null;
    instance.update();
  }
  const meta = form.querySelector("[data-artwork-metadata]");
  meta.textContent = "";
  meta.dataset.artworkMetadata = "";
  form.querySelector("#upload-status").textContent = t(
    "Add artwork or create a text-only design.",
  );
  rememberCustomerDraft(form);
});
