"use strict";
function mountStudioRefinements(instance) {
  const root = instance.root,
    canvas = root.querySelector(".studio-canvas"),
    figure = canvas.parentElement,
    toolbar = document.createElement("div");
  toolbar.className = "studio-refinement-toolbar";
  toolbar.innerHTML = `<div class="row"><button type="button" class="btn outline sm" data-studio-undo>${t("Undo")}</button><button type="button" class="btn outline sm" data-studio-redo>${t("Redo")}</button><label>${t("Preview zoom")}<select data-studio-zoom dir="ltr"><option value="1">100%</option><option value="1.5">150%</option><option value="2">200%</option></select></label></div><div class="studio-nudge" role="group" aria-label="${t("Move selected artwork or text")}"><button type="button" data-nudge="left" aria-label="${t("Move left")}">←</button><button type="button" data-nudge="up" aria-label="${t("Move up")}">↑</button><button type="button" data-nudge="down" aria-label="${t("Move down")}">↓</button><button type="button" data-nudge="right" aria-label="${t("Move right")}">→</button><button type="button" data-nudge="center">${t("Center selected")}</button></div><label class="check"><input type="checkbox" data-alignment-guides checked>${t("Center alignment guides")}</label><label class="check"><input type="checkbox" data-snap-center checked>${t("Snap to center")}</label><p class="small">${t("Zoom changes only the preview. Use arrows for precise placement; physical artwork is never mirrored.")}</p>`;
  // Customer controls scroll below the compact pinned preview on a phone.
  // Keep shared editing actions out of that preview so it cannot grow taller than the screen.
  (root.closest("[data-form=customer-design]") ? root.querySelector(".studio-controls") : root.querySelector(".studio-visual")).append(toolbar);
  const viewport = document.createElement("div");
  viewport.className = "studio-zoom-viewport";
  canvas.before(viewport);
  viewport.append(canvas);
  const snapshot = () =>
    JSON.stringify({
      placements: instance.state.placements,
      text_layers: instance.state.text_layers || {},
      active_product: instance.state.active_product,
    });
  let history = [snapshot()],
    index = 0,
    last = 0,
    restoring = false,
    gesture = null;
  const persist = instance.persist;
  const sync = () => {
    toolbar.querySelector("[data-studio-undo]").disabled = index <= 0;
    toolbar.querySelector("[data-studio-redo]").disabled =
      index >= history.length - 1;
  };
  instance.persist = () => {
    const current = snapshot();
    if (!restoring && current !== history[index]) {
      const stamp = performance.now(),
        group = gesture || document.activeElement;
      if (
        index === history.length - 1 &&
        index > 0 &&
        stamp - last < 500 &&
        instance.historyGroup === group
      )
        history[index] = current;
      else {
        history = history.slice(0, index + 1);
        history.push(current);
        if (history.length > 60) history.shift();
        index = history.length - 1;
      }
      last = stamp;
      instance.historyGroup = group;
    }
    sync();
    persist();
  };
  const restore = (delta) => {
    if (index + delta < 0 || index + delta >= history.length) return;
    index += delta;
    const state = JSON.parse(history[index]);
    Object.assign(instance.state, state);
    restoring = true;
    try {
      instance.syncControls();
      instance.update();
    } finally {
      restoring = false;
      last = 0;
    }
    sync();
  };
  toolbar.addEventListener("click", (event) => {
    const control = event.target.closest("button");
    if (!control) return;
    if (control.hasAttribute("data-studio-undo")) restore(-1);
    else if (control.hasAttribute("data-studio-redo")) restore(1);
    else if (control.dataset.nudge) {
      const target =
          (instance.customerTool === "text" &&
            instance.state.text_layers?.[instance.product().id]?.find(
              (layer) => layer.id === instance.selectedText,
            )) ||
          (typeof customerDragTarget === "function" &&
            customerDragTarget(instance)) ||
          instance.state.placements[instance.product().id],
        move = {
          left: [-0.01, 0],
          right: [0.01, 0],
          up: [0, -0.01],
          down: [0, 0.01],
        }[control.dataset.nudge];
      if (control.dataset.nudge === "center") {
        target.x = 0.5;
        target.y = 0.5;
      } else {
        target.x = Math.max(0, Math.min(1, target.x + move[0]));
        target.y = Math.max(0, Math.min(1, target.y + move[1]));
      }
      last = 0;
      instance.syncControls();
      instance.update();
    }
  });
  toolbar.addEventListener("change", (event) => {
    if (event.target.matches("[data-studio-zoom]")) {
      canvas.style.width = 100 * Number(event.target.value) + "%";
      viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
      viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2;
    } else instance.update();
  });
  canvas.addEventListener("pointerdown", () => {
    gesture = {};
    last = 0;
  });
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
    canvas.addEventListener(name, () => {
      gesture = null;
      last = 0;
    });
  root.addEventListener("keydown", (event) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "z" &&
      !event.target.matches("input,textarea,select")
    ) {
      event.preventDefault();
      restore(event.shiftKey ? 1 : -1);
    }
  });
  instance.drawAlignment = () => {
    if (
      !toolbar.querySelector("[data-alignment-guides]").checked ||
      !instance.asset
    )
      return;
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.scale(canvas.width / 1000, canvas.height / 1000);
    ctx.strokeStyle = "#0c777d";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    const vertices = instance.asset.projection.vertices;
    for (const axis of [2, 3]) {
      const points = [];
      for (const ids of instance.asset.projection.triangles) {
        for (let i = 0; i < 3; i++) {
          const a = vertices[ids[i]],
            b = vertices[ids[(i + 1) % 3]];
          if (
            (a[axis] < 0.5 && b[axis] >= 0.5) ||
            (a[axis] > 0.5 && b[axis] <= 0.5)
          ) {
            const t = (0.5 - a[axis]) / (b[axis] - a[axis]);
            points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
          }
        }
      }
      if (points.length > 1) {
        points.sort((a, b) => a[axis === 2 ? 1 : 0] - b[axis === 2 ? 1 : 0]);
        ctx.beginPath();
        ctx.moveTo(...points[0]);
        for (const point of points.slice(1)) ctx.lineTo(...point);
        ctx.stroke();
      }
    }
    ctx.restore();
  };
  sync();
  root.addEventListener("input", () => {
    const form = root.closest("form");
    if (!form) return;
    const checks = form.querySelector(".submission-checklist");
    if (checks) {
      checks.querySelector("[data-submit-check=art]").dataset.complete = String(
        !!instance.state.artwork_id,
      );
      checks.querySelector("[data-submit-check=details]").dataset.complete =
        String(
          !!form.elements.title?.value.trim() &&
            !!form.elements.description?.value.trim(),
        );
    }
  });
}
function updateStudioWarnings(instance, glyphs = null) {
  const root = instance.root,
    product = instance.product(),
    placement = instance.state.placements[product.id],
    meta = instance.metadata;
  let node = root.querySelector("[data-studio-warnings]");
  if (!node) {
    node = document.createElement("ul");
    node.dataset.studioWarnings = "";
    node.className = "studio-preflight";
    node.setAttribute("aria-live", "polite");
    root.querySelector(".studio-quality").after(node);
  }
  const warnings = [];
  if (meta && (meta.opaque === true || !meta.has_alpha))
    warnings.push(
      "Your image has an opaque background. It will print as part of the design. Use a transparent PNG if that is not intended.",
    );
  if (meta) {
    const quality = instance.math.qualityEstimate(
      meta.width,
      meta.height,
      product,
      placement,
    );
    if (quality.cropped)
      warnings.push("Artwork is cropped at this placement. Check every edge.");
    if (quality.level === "low" || quality.level === "review")
      warnings.push(
        "Image resolution needs review at this size. Use a larger original or reduce its scale.",
      );
  }
  if (glyphs) instance.preflightGlyphs = glyphs;
  const layers = instance.state.text_layers?.[product.id] || [],
    cw = 900,
    ch = (900 * product.preview[1]) / product.preview[0];
  for (const layer of layers) {
    const image = instance.preflightGlyphs?.find(
      (g) => g.id === layer.id,
    )?.image;
    if (!image || !layer.text.trim()) continue;
    const a = (layer.rotation * Math.PI) / 180,
      w =
        (Math.abs(Math.cos(a)) * image.naturalWidth +
          Math.abs(Math.sin(a)) * image.naturalHeight) /
        cw,
      h =
        (Math.abs(Math.sin(a)) * image.naturalWidth +
          Math.abs(Math.cos(a)) * image.naturalHeight) /
        ch;
    if (
      layer.x - w / 2 < 0.05 ||
      layer.x + w / 2 > 0.95 ||
      layer.y - h / 2 < 0.05 ||
      layer.y + h / 2 > 0.95
    ) {
      warnings.push(
        "Text is near or outside the provisional safe area. Move it inward or reduce its size.",
      );
      break;
    }
  }
  node.innerHTML = [...new Set(warnings)]
    .map((w) => `<li>${esc(t(w))}</li>`)
    .join("");
  node.hidden = !warnings.length;
}
