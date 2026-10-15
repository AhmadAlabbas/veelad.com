/* Private account drafts: server saves, device recovery and optimistic revisions. */
"use strict";
let customerSaveTimer = null,
  customerSaveQueue = Promise.resolve(),
  customerSaveError = null;
function customerDraftPayload(draft) {
  return {
    title: draft.title || "",
    product_id: draft.product_id,
    variant: draft.variant || "Standard",
    upload_id: draft.upload_id || null,
    design_studio: draft.design_studio,
  };
}
const customerFingerprint = (draft) =>
  JSON.stringify(customerDraftPayload(draft));
function customerDeviceDrafts() {
  return user ? read("customer-drafts-" + user.id, {}) : {};
}
function rememberDraftOnDevice(draft, dirty = true) {
  if (!user || draft.user_id !== user.id) return false;
  try {
    const all = customerDeviceDrafts();
    all[draft.id] = {
      ...clone(draft),
      device_dirty: dirty,
      device_updated: Date.now(),
    };
    const ordered = Object.values(all)
      .sort((a, b) => b.device_updated - a.device_updated)
      .slice(0, 20);
    localStorage.setItem(
      "veelad-v2-customer-drafts-" + user.id,
      JSON.stringify(Object.fromEntries(ordered.map((d) => [d.id, d]))),
    );
    return true;
  } catch {
    return false;
  }
}
function customerSaveStatus(message, failed = false) {
  const node = document.querySelector("[data-customer-save-status]");
  const reload = document.querySelector("[data-reload-customer-draft]");
  if (reload) reload.hidden = !customerDraft?.conflict;
  if (node) {
    node.textContent = t(message);
    node.dataset.failed = String(failed);
  }
}
function queueCustomerAutosave() {
  if (!customerDraft?.design_studio || !user) return;
  const d = customerDraft,
    hasContent =
      d.upload_id ||
      d.title ||
      Object.values(d.design_studio.text_layers || {}).some(
        (layers) => layers.length,
      );
  if (!hasContent && !d.revision) return;
  d.id ||= id("draft-");
  d.revision ||= 0;
  const changed = customerFingerprint(d) !== d.server_hash;
  if (!changed) {
    customerSaveStatus("All changes saved");
    return;
  }
  const device = rememberDraftOnDevice(d, true);
  customerSaveStatus(
    d.conflict
      ? "This draft changed in another tab. Reload it or save a copy."
      : device
        ? "Saving your design..."
        : "Saving your design. Device recovery is unavailable.",
    !!d.conflict,
  );
  clearTimeout(customerSaveTimer);
  if (!d.conflict)
    customerSaveTimer = setTimeout(
      () => flushCustomerDraft().catch(() => {}),
      900,
    );
}
async function flushCustomerDraft() {
  clearTimeout(customerSaveTimer);
  const work = async () => {
    const d = customerDraft;
    if (!d?.id || !d.design_studio || !user || d.user_id !== user.id) return;
    if (d.conflict)
      throw Error(
        t("This draft changed in another tab. Reload it or save a copy."),
      );
    const payload = customerDraftPayload(d),
      fingerprint = JSON.stringify(payload);
    if (d.server_hash === fingerprint) return;
    try {
      const saved = await api("customer-draft", {
        ...payload,
        id: d.id,
        revision: d.revision || 0,
      });
      if (customerDraft?.id !== d.id) {
        const backup = customerDeviceDrafts()[d.id] || d;
        rememberDraftOnDevice(
          { ...backup, revision: saved.revision, server_hash: fingerprint },
          customerFingerprint(backup) !== fingerprint,
        );
      }
      if (customerDraft?.id === d.id) {
        customerDraft.revision = saved.revision;
        customerDraft.server_hash = fingerprint;
        customerDraft.updated_at = saved.updated_at;
        customerSaveError = null;
        const dirty = customerFingerprint(customerDraft) !== fingerprint;
        rememberDraftOnDevice(customerDraft, dirty);
        customerSaveStatus(
          dirty ? "Saving your design..." : "All changes saved",
        );
        if (!params.has("draft") && route === "create") {
          params.set("draft", d.id);
          history.replaceState(
            null,
            "",
            normalUrl("create", Object.fromEntries(params)),
          );
        }
        if (dirty) queueCustomerAutosave();
      }
    } catch (error) {
      customerSaveError = error;
      if (customerDraft?.id === d.id) {
        if (error.code === "DRAFT_CONFLICT") customerDraft.conflict = true;
        const device = rememberDraftOnDevice(customerDraft, true);
        customerSaveStatus(
          customerDraft.conflict
            ? "This draft changed in another tab. Reload it or save a copy."
            : device
              ? "Could not sync. Your changes are saved on this device. Retry when connected."
              : "Could not save your changes. Keep this page open and retry.",
          true,
        );
      }
      throw error;
    }
  };
  const next = customerSaveQueue.catch(() => {}).then(work);
  customerSaveQueue = next;
  return next;
}
async function prepareCustomerCreate() {
  if (mode === "demo" || !user) return;
  if (customerDraft?.user_id !== user.id) customerDraft = null;
  const fresh = params.has("new");
  if (fresh) {
    customerDraft = null;
    params.delete("new");
    history.replaceState(
      null,
      "",
      normalUrl("create", Object.fromEntries(params)),
    );
  }
  if (params.has("design") && !params.has("draft")) return;
  const requested = params.get("draft"),
    copy = params.get("copy"),
    duplicate = params.get("duplicate");
  if (
    customerDraft &&
    (!requested || customerDraft.id === requested) &&
    !copy &&
    !duplicate &&
    !fresh
  )
    return;
  const local = customerDeviceDrafts();
  let loaded = null,
    base = null;
  if (!fresh) {
    try {
      const response = await api(
        "customer-draft",
        null,
        copy
          ? { copy }
          : requested || duplicate
            ? { id: requested || duplicate }
            : {},
      );
      loaded = response.draft;
      base = response.product;
    } catch (error) {
      if (!requested || !local[requested]?.device_dirty) throw error;
    }
  }
  const all = local,
    device =
      all[requested] ||
      (!requested && !copy && !duplicate && !fresh
        ? Object.values(all)
            .filter((d) => d.device_dirty)
            .sort((a, b) => b.device_updated - a.device_updated)[0]
        : null);
  if (loaded) {
    const hash = customerFingerprint(loaded);
    customerDraft = {
      ...loaded,
      user_id: user.id,
      server_hash: hash,
      base_product: base,
      editing_key: null,
    };
    if (
      device?.id === loaded.id &&
      device.device_dirty &&
      customerFingerprint(device) !== hash
    ) {
      customerDraft = {
        ...device,
        user_id: user.id,
        base_product: base,
        conflict: device.revision !== loaded.revision,
      };
    }
  } else if (device) customerDraft = { ...device, user_id: user.id };
  else customerDraft = null;
  if (copy || duplicate) {
    customerDraft = {
      ...customerDraft,
      id: id("draft-"),
      revision: 0,
      server_hash: null,
      conflict: false,
      editing_key: null,
      title: duplicate
        ? [
            ...((customerDraft?.title || t("Untitled design")) +
              " " +
              t("(copy)")),
          ]
            .slice(0, 80)
            .join("")
        : customerDraft?.title || "",
    };
    params.delete("copy");
    params.delete("duplicate");
    params.set("draft", customerDraft.id);
    history.replaceState(
      null,
      "",
      normalUrl("create", Object.fromEntries(params)),
    );
  }
  customerSaveError = null;
}
function customerEditorProducts() {
  const available = customizableProducts(),
    p = customerDraft?.base_product;
  if (p && !available.some((item) => item.id === p.id)) available.push(p);
  return available;
}
function customerLibraryPage(data = {}) {
  if (!user)
    return `<main id="main" class="container section">${empty(t("Your designs belong to you."), t("Sign in to open your private design library."), link(t("Sign in"), "login", "btn", { next: "my-designs" }))}</main>`;
  const drafts = data.drafts || [],
    designs = data.designs || [];
  const cards = (entries, draft) =>
    entries
      .map((d) => {
        const type =
            studioTypes.find((type) => type[1] === d.category)?.[0] || "print",
          content =
            d.upload_id ||
            d.design_studio?.text_layers?.[type]?.some((layer) =>
              layer.text.trim(),
            );
        const src =
          draft && content
            ? "/api.php?" +
              new URLSearchParams({
                route: "customer-draft-preview",
                id: d.id,
                v: d.revision,
              })
            : d.mockup_upload_id
              ? "/api.php?" +
                new URLSearchParams({ route: "image", id: d.mockup_upload_id })
              : "/assets/mockups/" + type + ".webp";
        return `<article class="customer-library-card" data-library-id="${esc(d.id)}"><a href="${esc(url("create", draft ? { draft: d.id } : { copy: d.id }))}"><img src="${esc(src)}" loading="lazy" alt="${esc(d.title || t("Your personal design"))}"></a><div><span class="eyebrow">${t(draft ? "Draft" : "Saved design")} · ${t(d.category)}</span><h3>${esc(d.title || t("Untitled design"))}</h3><p class="small">${localDate(d.updated_at || d.created_at, { dateStyle: "medium" })}</p><div class="customer-library-actions">${link(t(draft ? "Continue editing" : "Use this design"), "create", "btn sm", draft ? { draft: d.id } : { copy: d.id })}${draft ? link(t("Make a copy"), "create", "text-link", { duplicate: d.id }) + button(t("Remove from library"), "archive-customer-draft", `data-id="${esc(d.id)}" data-revision="${d.revision}"`, "text-link") : ""}</div></div></article>`;
      })
      .join("");
  return `<main id="main" class="container section customer-library"><div class="section-title"><div><span class="eyebrow">${t("YOUR PRIVATE CREATIVE SPACE")}</span><h1>${t("My Designs")}</h1><p>${t("Your drafts, your words, your artwork. Come back whenever inspiration strikes.")}</p></div>${link(t("Start a new design"), "create", "btn", { new: "1" })}</div>${!drafts.length && !designs.length ? empty(t("Your next idea starts here."), t("Design an item and your progress will be saved here automatically."), link(t("Create your own"), "create", "btn", { new: "1" })) : ""}${drafts.length ? `<h2>${t("Drafts")}</h2><div class="customer-library-grid">${cards(drafts, true)}</div>` : ""}${designs.length ? `<h2>${t("Saved designs")}</h2><p>${t("These are saved copies. Editing creates a new draft and never changes an existing order.")}</p><div class="customer-library-grid">${cards(designs, false)}</div>` : ""}${data.page > 0 || data.has_more ? `<nav class="customer-library-pagination" aria-label="${t("Design library pages")}">${data.page > 0 ? link(t("Previous designs"), "my-designs", "btn outline", { page: data.page - 1 }) : ""}${data.has_more ? link(t("More designs"), "my-designs", "btn outline", { page: (data.page || 0) + 1 }) : ""}</nav>` : ""}</main>`;
}
document.addEventListener("click", async (event) => {
  const action = event.target.closest("[data-action]");
  if (action?.dataset.action === "archive-customer-draft") {
    event.preventDefault();
    openModal(
      t("Remove this draft?"),
      `<p>${t("It will be hidden from your library. Existing orders and original files stay unchanged.")}</p>${button(t("Remove from library"), "confirm-archive-customer-draft", `data-id="${esc(action.dataset.id)}" data-revision="${esc(action.dataset.revision)}"`, "btn full")}`,
    );
  }
  if (action?.dataset.action === "confirm-archive-customer-draft") {
    event.preventDefault();
    action.disabled = true;
    try {
      await api("customer-draft", {
        action: "archive",
        id: action.dataset.id,
        revision: Number(action.dataset.revision),
      });
      if (customerDraft?.id === action.dataset.id) customerDraft = null;
      const all = customerDeviceDrafts();
      delete all[action.dataset.id];
      write("customer-drafts-" + user.id, all);
      closeModal();
      await render();
    } catch (error) {
      toast(error.message);
      action.disabled = false;
    }
  }
  if (action?.dataset.action === "confirm-reload-customer-draft") {
    const all = customerDeviceDrafts();
    delete all[customerDraft.id];
    write("customer-drafts-" + user.id, all);
    clearTimeout(customerSaveTimer);
    customerDraft = null;
    closeModal();
    await render();
    return;
  }
  const form = event.target.closest("[data-form=customer-design]");
  if (!form) return;
  if (event.target.closest("[data-reload-customer-draft]"))
    openModal(
      t("Reload the saved version?"),
      `<p>${t("This discards unsynced edits in this tab. Save a copy first if you want to keep them.")}</p>${button(t("Reload saved version"), "confirm-reload-customer-draft", "", "btn full")}`,
    );

  if (event.target.closest("[data-save-customer-draft]")) {
    try {
      await flushCustomerDraft();
      toast(t("Your draft is saved."));
    } catch (error) {
      toast(error.message);
    }
  }
  if (event.target.closest("[data-copy-customer-draft]")) {
    const previousId = customerDraft?.id;
    customerDraft = {
      ...customerDraft,
      id: id("draft-"),
      revision: 0,
      server_hash: null,
      conflict: false,
      editing_key: null,
    };
    params.delete("design");
    params.set("draft", customerDraft.id);
    history.replaceState(
      null,
      "",
      normalUrl("create", Object.fromEntries(params)),
    );
    queueCustomerAutosave();
    try {
      await flushCustomerDraft();
      if (previousId) {
        const all = customerDeviceDrafts();
        delete all[previousId];
        write("customer-drafts-" + user.id, all);
      }
      toast(t("Your draft is saved."));
    } catch (error) {
      toast(error.message);
    }
  }
});
window.addEventListener("online", () => {
  if (customerDraft && !customerDraft.conflict)
    flushCustomerDraft().catch(() => {});
  const form = document.querySelector("[data-form=customer-design]"),
    root = form?.querySelector(".design-studio"),
    instance = root && studioInstances.get(root);
  if (instance?.state) {
    instance.glyphCache?.clear();
    if (customerDraft?.upload_id && !instance.image) {
      instance.source = null;
      instance.loadSource(studioSource(customerDraft), customerDraft.upload_id);
      refreshArtworkMetadata(customerDraft.upload_id);
    } else instance.update();
  }
});
window.addEventListener("pagehide", () => {
  if (customerDraft && user && customerDraft.user_id === user.id)
    rememberDraftOnDevice(
      customerDraft,
      customerFingerprint(customerDraft) !== customerDraft.server_hash,
    );
});
