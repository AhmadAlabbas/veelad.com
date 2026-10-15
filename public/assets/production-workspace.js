"use strict";
const productionStageLabels = {
  preparing: "Preparing artwork",
  awaiting_approval: "Awaiting your approval",
  ready: "Ready for printing",
  printing: "Printing",
  quality_check: "Quality check",
  packed: "Packed",
};
const productionCheckLabels = {
  originals: "Original files checked",
  placement: "Placement and text checked",
  options: "Product options and quantities checked",
  print_quality: "Print quality checked",
  packaging: "Packaging checked",
};
function productionLineId(o, item, index) {
  return item.line_id || o.id + "-line-" + index;
}
function productionProofImage(o, proof) {
  return (
    "/api.php?" +
    new URLSearchParams({
      route: "order-proof-image",
      id: o.id,
      proof: proof.id,
      ...(params.get("token") ? { token: params.get("token") } : {}),
    })
  );
}
function productionProofs(o, customer = false) {
  const p = o.production;
  if (!p?.proofs?.length) return "";
  return `<div class="proof-grid">${o.items
    .map((item, index) => {
      const line = productionLineId(o, item, index),
        proofs = p.proofs.filter((proof) => proof.line_id === line),
        latest = proofs.at(-1);
      return proofs.length
        ? `<section class="proof-card"><h4>${esc(localField(item, "title"))} · ${esc(localVariant(item, item.variant))}</h4>${proofs.map((proof) => `<article class="proof-version"><a href="${esc(productionProofImage(o, proof))}" target="_blank" rel="noopener"><img src="${esc(productionProofImage(o, proof))}" alt="${esc(t("Final production proof"))}" loading="lazy"></a><p dir="auto">${esc(proof.caption)}</p><span class="pill">${t(proof !== latest && proof.status === "pending" ? "Replaced by a newer proof" : { pending: "Awaiting your approval", approved: "Proof approved", changes_requested: "Changes requested" }[proof.status])}</span><small>${localDate(proof.created_at)}</small>${proof.feedback ? `<p class="product-long-text" dir="auto">${esc(proof.feedback)}</p>` : ""}${customer && proof === latest && proof.status === "pending" && !["cancelled", "shipped", "delivered"].includes(o.status) ? `<form data-production-form="response"><input type="hidden" name="id" value="${esc(o.id)}"><input type="hidden" name="revision" value="${p.revision}"><input type="hidden" name="proof_id" value="${esc(proof.id)}"><label class="field">${t("Feedback or requested changes")}<textarea name="feedback" maxlength="1000" dir="auto"></textarea></label><label class="check"><input type="checkbox" name="confirm">${t("I checked the artwork, text, placement and selected product in this final proof.")}</label><div class="row"><button class="btn sm" name="decision" value="approved">${t("Approve for printing")}</button><button class="btn outline sm" name="decision" value="changes_requested">${t("Request changes")}</button></div></form>` : ""}</article>`).join("")}</section>`
        : "";
    })
    .join("")}</div>`;
}
function customerProductionPanel(o) {
  const p = o.production;
  if (!p) return "";
  return `<section class="customer-production"><h3>${t("Production progress")}</h3><ol class="production-progress">${Object.entries(
    productionStageLabels,
  )
    .map(
      ([key, label], index) =>
        `<li ${p.stage === key ? 'aria-current="step"' : ""} class="${index <= Object.keys(productionStageLabels).indexOf(p.stage) ? "reached" : ""}">${t(label)}</li>`,
    )
    .join(
      "",
    )}</ol>${p.customer_note ? `<p class="notice product-long-text" dir="auto">${esc(p.customer_note)}</p>` : ""}<p class="small">${t("Review proofs here. Printing starts only after approval and payment confirmation.")}</p>${productionProofs(o, true)}${
    p.history?.length
      ? `<details><summary>${t("Progress history")}</summary><ul class="production-history">${p.history
          .slice()
          .reverse()
          .map(
            (h) =>
              `<li>${localDate(h.at, { dateStyle: "medium", timeStyle: "short" })} · ${t(productionStageLabels[h.stage] || h.stage)}</li>`,
          )
          .join("")}</ul></details>`
      : ""
  }</section>`;
}
function productionOrderPanel(o) {
  const p = o.production || {
      revision: 0,
      stage: "preparing",
      checks: {},
      proofs: [],
    },
    closed = ["cancelled", "delivered", "shipped"].includes(o.status);
  return `<section class="production-order"><h3>${t("Production workspace")}</h3><p class="small">${t("Proof approval does not confirm payment. Templates remain provisional until supplier specifications are checked.")}</p>${productionProofs(o)}${
    closed
      ? `<p>${t("This order is closed for production changes.")}</p>`
      : `<form data-production-form="update" class="panel stack"><input type="hidden" name="id" value="${esc(o.id)}"><input type="hidden" name="revision" value="${p.revision}"><label class="field">${t("Production stage")}<select name="stage">${Object.entries(
          productionStageLabels,
        )
          .map(
            ([key, label]) =>
              `<option value="${key}" ${p.stage === key ? "selected" : ""}>${t(label)}</option>`,
          )
          .join(
            "",
          )}</select></label><fieldset><legend>${t("Preparation checklist")}</legend>${Object.entries(
          productionCheckLabels,
        )
          .map(
            ([key, label]) =>
              `<label class="check"><input type="checkbox" name="${key}" ${p.checks[key] ? "checked" : ""}>${t(label)}</label>`,
          )
          .join(
            "",
          )}</fieldset><label class="field">${t("Internal production notes")}<textarea name="internal_notes" maxlength="3000" dir="auto">${esc(p.internal_notes || "")}</textarea></label><label class="field">${t("Update visible to the customer")}<textarea name="customer_note" maxlength="1000" dir="auto">${esc(p.customer_note || "")}</textarea></label><button class="btn">${t("Save production progress")}</button></form>${["preparing", "awaiting_approval", "ready"].includes(p.stage) ? `<form data-production-form="proof" class="panel stack"><h4>${t("Send a final proof")}</h4><p class="small">${t("Upload a checked product preview for the customer. This does not replace the original print file.")}</p><input type="hidden" name="id" value="${esc(o.id)}"><input type="hidden" name="revision" value="${p.revision}"><label class="field">${t("Order item")}<select name="line_id">${o.items.map((item, i) => `<option value="${esc(productionLineId(o, item, i))}">${esc(localField(item, "title"))} · ${esc(localVariant(item, item.variant))} × ${localNumber(item.qty)}</option>`).join("")}</select></label><label class="field">${t("Final production proof")}<input type="file" name="proof_file" accept="image/png,image/jpeg" required></label><label class="field">${t("Proof explanation")}<textarea name="caption" maxlength="1000" dir="auto"></textarea></label><button class="btn outline">${t("Send proof for approval")}</button></form>` : ""}`
  }</section>`;
}
function productionBoard(orders) {
  const stage = params.get("stage") || "",
    query = (params.get("q") || "").toLowerCase(),
    open = orders.filter(
      (o) => !["cancelled", "delivered", "shipped"].includes(o.status),
    ),
    list = open.filter(
      (o) =>
        (!stage || (o.production?.stage || "preparing") === stage) &&
        (!query ||
          [o.id, o.customer.name, ...o.items.map((i) => i.title)]
            .join(" ")
            .toLowerCase()
            .includes(query)),
    );
  return `<div class="admin-title"><div><span class="eyebrow">${t("FROM ARTWORK TO PACKED ORDER")}</span><h1>${t("Production")}</h1><p>${t("Prepare files, collect approvals and check every item before dispatch.")}</p></div></div><div class="production-counts">${Object.entries(
    productionStageLabels,
  )
    .map(([key, label]) =>
      link(
        `<strong>${localNumber(open.filter((o) => (o.production?.stage || "preparing") === key).length)}</strong><span>${t(label)}</span>`,
        "admin",
        stage === key ? "active" : "",
        { tab: "production", stage: key },
      ),
    )
    .join(
      "",
    )}</div><form data-form="production-filter" class="table-toolbar"><input name="q" value="${esc(query)}" type="search" placeholder="${t("Search orders...")}" aria-label="${t("Search orders")}"><select name="stage"><option value="">${t("All stages")}</option>${Object.entries(
    productionStageLabels,
  )
    .map(
      ([key, label]) =>
        `<option value="${key}" ${stage === key ? "selected" : ""}>${t(label)}</option>`,
    )
    .join(
      "",
    )}</select><button class="btn sm">${t("Filter")}</button></form><div class="production-board">${list.map((o) => `<article class="production-job panel"><div class="row between"><h3>${esc(o.id)}</h3><span class="pill">${t(productionStageLabels[o.production?.stage || "preparing"])}</span></div><p>${esc(o.customer.name)} · ${localDate(o.created_at)}</p><p class="small">${esc(statusLabel(o.payment_status))} · ${money(o.total)}</p><ul>${o.items.map((item) => `<li>${esc(localField(item, "title"))} · ${esc(localVariant(item, item.variant))} × ${localNumber(item.qty)}</li>`).join("")}</ul>${button(t("Open production order"), "manage-order", `data-id="${esc(o.id)}"`, "btn outline full")}</article>`).join("") || `<p class="notice">${t("No orders at this stage.")}</p>`}</div>`;
}
document.addEventListener("submit", async (event) => {
  const f = event.target;
  if (f.dataset.form === "production-filter") {
    event.preventDefault();
    const data = new FormData(f);
    go("admin", {
      tab: "production",
      q: data.get("q"),
      stage: data.get("stage"),
    });
    return;
  }
  const type = f.dataset.productionForm;
  if (!type) return;
  event.preventDefault();
  if (f.dataset.saving || !f.reportValidity()) return;
  f.dataset.saving = "true";
  const button = event.submitter;
  if (button) button.disabled = true;
  f.querySelector(".form-error")?.remove();
  try {
    const v = Object.fromEntries(new FormData(f));
    v.revision = Number(v.revision);
    if (type === "proof") {
      const body = new FormData();
      body.append("artwork", f.elements.proof_file.files[0]);
      const response = await fetch("/api.php?route=upload", {
          method: "POST",
          headers: { "X-CSRF-Token": csrf },
          body,
          credentials: "same-origin",
        }),
        uploaded = await response.json();
      if (!response.ok) throw Error(uploaded.error || "Upload failed.");
      delete v.proof_file;
      v.upload_id = uploaded.upload_id;
    }
    if (type === "update")
      v.checks = Object.fromEntries(
        Object.keys(productionCheckLabels).map((key) => [key, !!v[key]]),
      );
    if (type === "response") {
      v.decision = button.value;
      v.confirm = !!v.confirm;
      v.token = params.get("token") || "";
    } else v.action = type;
    await api(
      type === "response" ? "order-proof-response" : "admin-production",
      v,
    );
    if (type === "response") await render({ preserveScroll: true });
    else {
      await render({ preserveScroll: true });
      manageOrder(v.id);
    }
    toast(
      t(
        type === "proof"
          ? "Proof sent."
          : type === "response"
            ? "Your response was saved."
            : "Production progress saved.",
      ),
    );
  } catch (error) {
    const node = document.createElement("p");
    node.className = "notice error form-error";
    node.setAttribute("role", "alert");
    node.textContent = localizedError(error.message);
    f.prepend(node);
  } finally {
    delete f.dataset.saving;
    if (button) button.disabled = false;
  }
});

function productionLineCard(o, p) {
  const type = studioTypes.find(([, category]) => category === p.category)?.[0],
    placement = p.design_studio?.placements?.[type],
    layers = p.design_studio?.text_layers?.[type] || [];
  return `<section class="production-line-card"><div class="row">${p.mockup_upload_id ? photo(p, "customer-order-preview") : ""}<div><h4>${esc(localField(p, "title"))}</h4>${p.design_title ? `<p>${esc(p.design_title)}</p>` : ""}<p>${esc(t(p.category))} · ${esc(localVariant(p, p.variant))} × ${localNumber(p.qty)} — ${money(p.price * p.qty)}</p>${p.customer_customized ? `<strong>${t("Customer-designed item")}</strong>` : ""}</div></div>${placement ? `<dl class="production-placement"><div><dt>${t("Horizontal position (%)")}</dt><dd>${localNumber(placement.x * 100)}</dd></div><div><dt>${t("Vertical position (%)")}</dt><dd>${localNumber(placement.y * 100)}</dd></div><div><dt>${t("Scale")}</dt><dd>${localNumber(placement.scale * 100)}%</dd></div><div><dt>${t("Rotation")}</dt><dd>${localNumber(placement.rotation)}°</dd></div></dl>` : ""}${layers.map((layer) => `<div class="production-text-layer"><p class="product-long-text" dir="auto">${esc(layer.text)}</p><small><bdi dir="ltr">${esc(layer.font)} · ${esc(layer.color)} · ${localNumber(layer.size * 100)}% · ${localNumber(layer.rotation)}°</bdi></small></div>`).join("")}${!p.upload_id && !layers.some((layer) => layer.text.trim()) ? `<p class="notice error">${t("No print original is attached to this product.")}</p>` : ""}<div class="production-downloads">${p.upload_id ? button(t("Download original for printing"), "download-production-file", `data-id="${esc(p.upload_id)}"`, "btn outline sm") : ""}${p.design_studio ? button(t("Download composed artwork (.png)"), "download-design-artwork", `data-id="${esc(p.id)}" data-order="${esc(o.id)}" data-line="${esc(p.line_id || "")}"`, "btn outline sm") + button(t("Download placement plan (.json)"), "download-design-plan", `data-id="${esc(p.id)}" data-order="${esc(o.id)}" data-line="${esc(p.line_id || "")}"`, "btn outline sm") : ""}</div></section>`;
}

function needsProofReview(o){return !['cancelled','shipped','delivered'].includes(o.status)&&o.production?.proofs?.some(proof=>proof.status==='pending'&&proof===o.production.proofs.filter(other=>other.line_id===proof.line_id).at(-1));}
