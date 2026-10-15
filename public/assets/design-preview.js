/* Original artwork stays private. These product templates are provisional visualizations. */
"use strict";
const studioTypes = [
  ["shirt", "T-shirts", "T-shirt"],
  ["tote", "Tote bags", "Tote bag"],
  ["mug", "Mugs", "Mug"],
  ["notebook", "Notebooks", "Notebook"],
  ["phone", "Phone cases", "Phone case"],
  ["print", "Art prints", "Art print"],
  ["sticker", "Stickers", "Sticker"],
];
const studioInstances = new WeakMap(),
  studioAssets = new Map();
let studioResources;
function studioSource(p) {
  return p?.upload_id
    ? mode === "demo"
      ? dbLocal.uploads[p.upload_id]
      : "/api.php?route=image&id=" + encodeURIComponent(p.upload_id)
    : "";
}
function designArtworkUpload(p) {
  return `<section class="studio-upload upload-zone" data-studio-drop><div class="studio-upload-image" id="upload-preview">${p?.upload_id ? `<img class="upload-preview" src="${esc(studioSource(p))}" alt="${t("Your uploaded artwork")}">` : icon("upload")}</div><div><span class="eyebrow">${t("01 / ORIGINAL ARTWORK")}</span><h3>${t("Start with your best original.")}</h3><p>${t("Drop a PNG or JPEG here, or choose a file. Up to 25 MB and 60 megapixels.")}</p><label class="btn outline studio-file-label">${t("Choose artwork file")}<input type="file" id="artwork-file" accept="image/png,image/jpeg" aria-label="${esc(t("Choose artwork file"))}"></label><p class="small" id="upload-status" role="status">${t(p?.upload_id ? "Existing artwork retained until replaced." : "Your original stays private until the listing is approved.")}</p><progress class="studio-upload-progress" max="100" value="0" hidden aria-label="${t("Upload progress")}"></progress><p class="small artwork-metadata" data-artwork-metadata="${esc(p?.upload_id || "")}" role="status"></p></div><p class="small studio-upload-note">${t("Use a high-resolution transparent PNG for artwork without a background. Accepted does not mean print-ready. SVG and PDF are not supported yet.")}</p></section>`;
}
function designPlacementPreview(p = null) {
  const enabled = p?.print_formats?.length
    ? p.print_formats
    : [p?.category || "Art prints"];
  return `<section class="design-placement design-studio" aria-label="${t("Design placement preview")}" data-source="${esc(studioSource(p))}" data-artwork-id="${esc(p?.upload_id || "")}" data-category="${esc(p?.category || "Art prints")}"><input type="hidden" name="design_studio" value="${esc(p?.design_studio ? JSON.stringify(p.design_studio) : "")}"><div class="studio-heading"><div><span class="eyebrow">${t("02 / PRODUCT STUDIO")}</span><h3>${t("One design. A world of possibilities.")}</h3><p>${t("Choose your requested products, then make each placement your own.")}</p></div><span class="studio-provisional">${t("Provisional templates")}</span></div><div class="studio-products">${studioTypes.map(([id, category, label]) => `<article class="studio-product" data-product="${id}"><button type="button" class="studio-tile" data-studio-select="${id}" aria-label="${esc(t("Preview {product}", { product: t(label) }))}" aria-pressed="false"><div class="studio-tile-image"><img src="/assets/mockups/${id}.webp" alt="" loading="lazy"><canvas width="250" height="250" aria-hidden="true"></canvas></div><strong>${t(label)}</strong><span data-tile-quality>${t("Add artwork")}</span></button><label class="studio-enable"><input type="checkbox" name="print_formats" value="${esc(category)}" ${enabled.includes(category) ? "checked" : ""}>${t("Request product")}</label></article>`).join("")}</div><div class="studio-workspace"><div class="studio-visual"><div class="studio-toolbar"><label>${t("Preview product")}<select class="design-preview-format">${studioTypes.map(([id, , label]) => `<option value="${id}">${t(label)}</option>`).join("")}</select></label><label class="check"><input type="checkbox" data-studio-guides checked>${t("Print guides")}</label></div><figure class="design-mockup" data-format="print"><canvas class="studio-canvas" width="1000" height="1000" tabindex="0" role="img" aria-label="${esc(t("Product placement preview. Drag to position artwork or use the arrow keys."))}"></canvas><span class="studio-canvas-status" role="status">${t("Loading preview...")}</span><figcaption>${t("Visual preview — not a print file or a physical product sample")}</figcaption></figure><div class="studio-view-switch" data-studio-views></div><p class="small studio-drag-hint">${t("Drag the artwork to position it. Arrow keys make small adjustments.")}</p><button type="button" class="btn outline sm" data-studio-export>${t("Download preview")}</button></div><aside class="studio-controls"><div class="studio-control-heading"><h4 data-studio-product-title></h4><button type="button" class="studio-text-button" data-studio-reset>${t("Reset")}</button></div><div class="studio-quality" role="status" data-studio-quality></div><label class="field">${t("Scale")}<div class="studio-range"><input type="range" min="10" max="200" step="1" data-placement="scale" aria-label="${t("Scale")}" dir="ltr"><output data-output="scale"></output></div></label><label class="field">${t("Rotation")}<div class="studio-range"><input type="range" min="-180" max="180" step="1" data-placement="rotation" aria-label="${t("Rotation")}" dir="ltr"><output data-output="rotation"></output></div></label><div class="studio-position"><label class="field">${t("Horizontal position (%)")}<input type="number" min="0" max="100" step="1" data-placement="x" dir="ltr"></label><label class="field">${t("Vertical position (%)")}<input type="number" min="0" max="100" step="1" data-placement="y" dir="ltr"></label></div><div class="studio-quick-actions"><button type="button" class="btn outline sm" data-studio-fit="fit">${t("Fit artwork")}</button><button type="button" class="btn outline sm" data-studio-fit="fill">${t("Fill area")}</button><button type="button" class="btn outline sm" data-studio-center>${t("Center")}</button></div><label class="check"><input type="checkbox" data-placement="repeat">${t("Repeat as a pattern")}</label><fieldset class="studio-background"><legend>${t("Print-area background")}</legend><label class="check"><input type="checkbox" data-studio-transparent checked>${t("Transparent")}</label><input type="color" value="#ffffff" data-studio-color aria-label="${t("Background color")}"></fieldset><div class="studio-guide-key"><span></span>${t("Dashed line: provisional safe area")}</div><p class="small">${t("Keep important details inside the guide. Exact print size, bleed, colors and device cutouts need your supplier’s template and a physical sample.")}</p></aside></div><label class="check studio-listing-preview"><input type="checkbox" name="use_mockup_preview" ${p?.design_studio?.listing_mockup === false ? "" : "checked"}>${t("Use this product mockup as the listing’s main image")}</label><p class="small">${t("The preferred product type below determines the listing image. Other formats are requests for review, not separate products for sale. Your original is never altered.")}</p></section>`;
}
async function loadStudioResources() {
  return (studioResources ||= (async () => {
    const [math, response] = await Promise.all([
      import("/assets/design-math.js"),
      fetch("/assets/print-products.json"),
    ]);
    if (!response.ok) throw Error("Preview templates could not be loaded.");
    return { math, config: await response.json() };
  })());
}
async function loadStudioAsset(view) {
  if (!studioAssets.has(view))
    studioAssets.set(
      view,
      (async () => {
        const image = new Image();
        image.src = "/assets/mockups/" + view + ".webp";
        const response = await fetch("/assets/mockups/" + view + ".json");
        if (!response.ok) throw Error("Preview templates could not be loaded.");
        const projection = await response.json();
        await image.decode();
        return { image, projection };
      })(),
    );
  return studioAssets.get(view);
}
function studioTexture(image, product, placement, math) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = Math.round((900 * product.preview[1]) / product.preview[0]);
  const ctx = canvas.getContext("2d");
  if (placement.background !== "transparent") {
    ctx.fillStyle = placement.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const layout = math.imageLayout(
      image.naturalWidth,
      image.naturalHeight,
      canvas.width,
      canvas.height,
      placement,
    ),
    centers = math.patternCenters(
      layout,
      canvas.width,
      canvas.height,
      placement.repeat,
    );
  if (!centers)
    throw Error(
      "The pattern is too dense. Increase its scale or use a single placement.",
    );
  for (const center of centers) {
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(layout.angle);
    ctx.drawImage(
      image,
      -layout.width / 2,
      -layout.height / 2,
      layout.width,
      layout.height,
    );
    ctx.restore();
  }
  return canvas;
}
function drawStudio(canvas, asset, texture, math, guides = false) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(canvas.width / 1000, canvas.height / 1000);
  ctx.drawImage(asset.image, 0, 0, 1000, 1000);
  if (texture) {
    const warp = document.createElement("canvas");
    warp.width = canvas.width;
    warp.height = canvas.height;
    const layer = warp.getContext("2d"),
      pixels = texture
        .getContext("2d", { willReadFrequently: true })
        .getImageData(0, 0, texture.width, texture.height);
    layer.putImageData(
      new ImageData(
        math.projectTexture(
          pixels.data,
          texture.width,
          texture.height,
          asset.projection,
          warp.width,
          warp.height,
        ),
        warp.width,
        warp.height,
      ),
      0,
      0,
    );
    if (asset.projection.clip_path) {
      const mask = document.createElement("canvas");
      mask.width = warp.width;
      mask.height = warp.height;
      const m = mask.getContext("2d");
      m.scale(warp.width / 1000, warp.height / 1000);
      m.fillStyle = "white";
      m.fill(new Path2D(asset.projection.clip_path), "evenodd");
      layer.globalCompositeOperation = "destination-in";
      layer.drawImage(mask, 0, 0);
    }
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(warp, 0, 0, 1000, 1000);
    ctx.globalCompositeOperation = "source-over";
  }
  if (guides) {
    ctx.save();
    if (asset.projection.clip_path)
      ctx.clip(new Path2D(asset.projection.clip_path), "evenodd");
    ctx.strokeStyle = "#7554bd";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    for (const indices of asset.projection.triangles) {
      const vs = indices.map((i) => asset.projection.vertices[i]);
      for (let j = 0; j < 3; j++) {
        const a = vs[j],
          b = vs[(j + 1) % 3];
        if (
          (a[2] === 0 && b[2] === 0) ||
          (a[2] === 1 && b[2] === 1) ||
          (a[3] === 0 && b[3] === 0) ||
          (a[3] === 1 && b[3] === 1)
        ) {
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
        }
      }
    }
    ctx.stroke();
    /* Safe inset is projected through each surface, including curved mugs. */ const toPoint =
      (u, v) => {
        for (const ids of asset.projection.triangles) {
          const s = ids.map((i) => asset.projection.vertices[i]),
            det =
              (s[1][3] - s[2][3]) * (s[0][2] - s[2][2]) +
              (s[2][2] - s[1][2]) * (s[0][3] - s[2][3]);
          if (Math.abs(det) < 1e-9) continue;
          const a =
              ((s[1][3] - s[2][3]) * (u - s[2][2]) +
                (s[2][2] - s[1][2]) * (v - s[2][3])) /
              det,
            b =
              ((s[2][3] - s[0][3]) * (u - s[2][2]) +
                (s[0][2] - s[2][2]) * (v - s[2][3])) /
              det,
            c = 1 - a - b;
          if (a >= -0.001 && b >= -0.001 && c >= -0.001)
            return [
              a * s[0][0] + b * s[1][0] + c * s[2][0],
              a * s[0][1] + b * s[1][1] + c * s[2][1],
            ];
        }
        return null;
      };
    ctx.strokeStyle = "#447865";
    ctx.beginPath();
    let start = true;
    for (let side = 0; side < 4; side++)
      for (let j = 0; j <= 40; j++) {
        const n = 0.05 + (0.9 * j) / 40,
          p = toPoint(
            ...[
              [n, 0.05],
              [0.95, n],
              [1 - n, 0.95],
              [0.05, 1 - n],
            ][side],
          );
        if (p) {
          if (start) ctx.moveTo(...p);
          else ctx.lineTo(...p);
          start = false;
        } else start = true;
      }
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
function setDesignStudioMetadata(meta, form) {
  const root = (form || document).querySelector(".design-studio");
  const instance = root && studioInstances.get(root);
  if (instance) {
    instance.metadata = meta;
    instance.update();
  }
}
async function startDesignStudio(root) {
  if (studioInstances.has(root)) return;
  const instance = {
    root,
    source: null,
    image: null,
    metadata: null,
    serial: 0,
  };
  studioInstances.set(root, instance);
  try {
    const { math, config } = await loadStudioResources();
    if (!root.isConnected) return;
    Object.assign(instance, { math, config });
    const hidden = root.querySelector("[name=design_studio]");
    let saved;
    try {
      saved = JSON.parse(root.dataset.restoreState || hidden.value);
    } catch {}
    const fresh = () => ({
      version: 1,
      template_version: config.version,
      artwork_id: root.dataset.artworkId || null,
      listing_mockup: true,
      active_product:
        config.products.find((p) => p.category === root.dataset.category)?.id ||
        "print",
      placements: Object.fromEntries(
        config.products.map((p) => [p.id, math.defaultPlacement(p)]),
      ),
    });
    instance.state =
      saved?.template_version === config.version ? saved : fresh();
    instance.product = () =>
      config.products.find((p) => p.id === instance.state.active_product) ||
      config.products[0];
    instance.persist = () => {
      instance.state.listing_mockup = root.querySelector(
        "[name=use_mockup_preview]",
      ).checked;
      hidden.value = JSON.stringify(instance.state);
      root.dispatchEvent(new CustomEvent('design-studio-change', {bubbles:true}));
    };
    instance.syncControls = () => {
      root.querySelector("[name=use_mockup_preview]").checked =
        instance.state.listing_mockup !== false;
      const product = instance.product(),
        p = instance.state.placements[product.id];
      root.querySelector(".design-preview-format").value = product.id;
      root.querySelector(".design-mockup").dataset.format = product.id;
      root.querySelector("[data-studio-product-title]").textContent = t(
        product.label,
      );
      for (const node of root.querySelectorAll("[data-placement]")) {
        const key = node.dataset.placement;
        if (key === "repeat") node.checked = p.repeat;
        else
          node.value = Math.round(
            p[key] * (key === "scale" || key === "x" || key === "y" ? 100 : 1),
          );
      }
      root.querySelector("[data-studio-transparent]").checked =
        p.background === "transparent";
      root.querySelector("[data-studio-color]").value =
        p.background === "transparent" ? "#ffffff" : p.background;
      root.querySelector("[data-studio-views]").innerHTML =
        product.views.length > 1
          ? product.views
              .map(
                (view, i) =>
                  `<button type="button" class="btn outline sm" data-studio-view="${view}" aria-pressed="${view === p.view}">${t(i ? "Back view" : "Front view")}</button>`,
              )
              .join("")
          : "";
      for (const tile of root.querySelectorAll("[data-studio-select]"))
        tile.setAttribute(
          "aria-pressed",
          String(tile.dataset.studioSelect === product.id),
        );
      instance.persist();
    };
    instance.update = () => {
      if (!root.isConnected) return;
      const product = instance.product(),
        p = instance.state.placements[product.id],
        meta =
          instance.metadata ||
          (instance.image && {
            width: instance.image.naturalWidth,
            height: instance.image.naturalHeight,
          }),
        quality = math.qualityEstimate(meta?.width, meta?.height, product, p);
      root.querySelector("[data-output=scale]").textContent =
        localNumber(p.scale * 100) + "%";
      root.querySelector("[data-output=rotation]").textContent =
        localNumber(p.rotation) + "°";
      const q = root.querySelector("[data-studio-quality]");
      q.dataset.level = quality.level;
      q.innerHTML = `<strong>${t(quality.level === "empty" ? "Add artwork to check quality" : quality.level === "template_required" ? "Supplier template required" : quality.level === "recommended" ? "Resolution estimate: good" : quality.level === "review" ? "Resolution estimate: review needed" : "Resolution estimate: too low")}</strong>${quality.dpi !== null ? `<span>${esc(t("About {dpi} DPI at this placement", { dpi: localNumber(quality.dpi) }))}</span>` : ""}<small>${t(quality.cropped ? "Artwork extends beyond the printable area and will be cropped." : quality.dense ? "The pattern is too dense. Increase its scale or use a single placement." : "Provisional dimensions. Supplier review is still required.")}</small>`;
      instance.persist();
      cancelAnimationFrame(instance.frame);
      instance.frame = requestAnimationFrame(() => instance.render());
      clearTimeout(instance.thumbsTimer);
      instance.thumbsTimer = setTimeout(() => instance.thumbnails(), 250);
    };
    instance.render = async () => {
      const serial = ++instance.serial,
        product = instance.product(),
        p = { ...instance.state.placements[product.id] },
        status = root.querySelector(".studio-canvas-status");
      try {
        const asset = await loadStudioAsset(p.view);
        if (serial !== instance.serial || !root.isConnected) return;
        instance.asset = asset;
        const texture = instance.image
          ? studioTexture(instance.image, product, p, math)
          : null;
        drawStudio(
          root.querySelector(".studio-canvas"),
          asset,
          texture,
          math,
          root.querySelector("[data-studio-guides]").checked,
        );
        status.textContent = instance.image
          ? ""
          : t("Upload artwork to see its placement");
        status.hidden = !!instance.image;
      } catch (error) {
        status.hidden = false;
        status.textContent = t(error.message);
      }
    };
    instance.thumbnails = async () => {
      if(root.closest('[data-form=customer-design]'))return;
      for (const product of config.products) {
        if (!root.isConnected) return;
        const p = { ...instance.state.placements[product.id] },
          tile = root.querySelector("[data-product=" + product.id + "]");
        try {
          const asset = await loadStudioAsset(p.view);
          drawStudio(
            tile.querySelector("canvas"),
            asset,
            instance.image
              ? studioTexture(instance.image, product, p, math)
              : null,
            math,
          );
          const meta =
              instance.metadata ||
              (instance.image && {
                width: instance.image.naturalWidth,
                height: instance.image.naturalHeight,
              }),
            quality = math.qualityEstimate(
              meta?.width,
              meta?.height,
              product,
              p,
            );
          tile.querySelector("[data-tile-quality]").textContent =
            quality.dpi === null
              ? t(quality.level === "empty" ? "Add artwork" : "Template needed")
              : t("~{dpi} DPI", { dpi: localNumber(quality.dpi) });
        } catch (error) {
          tile.querySelector("[data-tile-quality]").textContent = t(
            error.message,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    };
    instance.loadSource = async (source, id) => {
      if (!source || instance.source === source) return;
      instance.source = source;
      const image = new Image();
      image.src = source;
      try {
        await image.decode();
        if (instance.source !== source || !root.isConnected) return;
        instance.image = image;
        instance.state.artwork_id =
          id || root.dataset.artworkId || instance.state.artwork_id || null;
        instance.metadata = null;
        instance.update();
        refreshArtworkMetadata(instance.state.artwork_id);
      } catch {
        root.querySelector(".studio-canvas-status").textContent =
          t("Preview not found.");
      }
    };
    root.addEventListener("input", (event) => {
      const node = event.target,
        p = instance.state.placements[instance.product().id];
      if (node.name === "use_mockup_preview") {
        instance.persist();
        return;
      }
      if (node.dataset.placement) {
        const key = node.dataset.placement;
        if (key === "repeat") p.repeat = node.checked;
        else {
          const value = Number(node.value);
          if (!Number.isFinite(value)) return;
          p[key] =
            key === "rotation"
              ? Math.max(-180, Math.min(180, value))
              : key === "scale"
                ? Math.max(0.1, Math.min(2, value / 100))
                : Math.max(0, Math.min(1, value / 100));
        }
      } else if (node.matches("[data-studio-transparent]"))
        p.background = node.checked
          ? "transparent"
          : root.querySelector("[data-studio-color]").value;
      else if (node.matches("[data-studio-color]")) {
        p.background = node.value;
        root.querySelector("[data-studio-transparent]").checked = false;
      } else if (!node.matches("[data-studio-guides]")) return;
      instance.update();
    });
    const select = (id, preferred = true) => {
      instance.state.active_product = id;
      if (
        preferred &&
        root.querySelector("[name=use_mockup_preview]").checked
      ) {
        const field = root.closest("form").querySelector("[name=category]");
        if (field) field.value = instance.product().category;
      }
      instance.syncControls();
      instance.update();
    };
    root.closest("form").addEventListener("change", (event) => {
      if (event.target.name === "category") {
        const product = config.products.find(
          (p) => p.category === event.target.value,
        );
        if (product) select(product.id, false);
      }
    });
    root.addEventListener("change", (event) => {
      if (event.target.matches(".design-preview-format"))
        select(event.target.value);
    });
    root.addEventListener("click", async (event) => {
      const node = event.target.closest("button");
      if (!node) return;
      const product = instance.product(),
        p = instance.state.placements[product.id];
      if (node.dataset.studioSelect) select(node.dataset.studioSelect);
      else if (node.dataset.studioView) {
        p.view = node.dataset.studioView;
        instance.syncControls();
        instance.update();
      } else if (node.hasAttribute("data-studio-reset")) {
        instance.state.placements[product.id] = math.defaultPlacement(product);
        instance.syncControls();
        instance.update();
      } else if (
        node.hasAttribute("data-studio-center") ||
        node.dataset.studioFit
      ) {
        p.x = p.y = 0.5;
        if (node.dataset.studioFit) {
          p.rotation = 0;
          p.repeat = false;
          p.scale =
            node.dataset.studioFit === "fit"
              ? 1
              : Math.min(
                  2,
                  Math.max(
                    product.preview[0] / instance.image?.naturalWidth,
                    product.preview[1] / instance.image?.naturalHeight,
                  ) /
                    Math.min(
                      product.preview[0] / instance.image?.naturalWidth,
                      product.preview[1] / instance.image?.naturalHeight,
                    ),
                ) || 1;
        }
        instance.syncControls();
        instance.update();
      } else if (node.hasAttribute("data-studio-export")) {
        if (!instance.image) {
          toast(t("Upload artwork to see its placement"));
          return;
        }
        try {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1000;
          drawStudio(
            canvas,
            await loadStudioAsset(p.view),
            studioTexture(instance.image, product, p, math),
            math,
          );
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 946, 1000, 54);
          ctx.fillStyle = "#333";
          ctx.font = "20px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(t("Visual preview — not a print file"), 500, 981);
          canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob),
              a = document.createElement("a");
            a.href = url;
            a.download = "veelad-" + product.id + "-preview.png";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
          });
        } catch (error) {
          toast(error.message);
        }
      }
    });
    const canvas = root.querySelector(".studio-canvas");
    const uv = (event) => {
      const rect = canvas.getBoundingClientRect();
      if (
        instance.asset?.projection.clip_path &&
        !canvas
          .getContext("2d")
          .isPointInPath(
            new Path2D(instance.asset.projection.clip_path),
            ((event.clientX - rect.left) * 1000) / rect.width,
            ((event.clientY - rect.top) * 1000) / rect.height,
            "evenodd",
          )
      )
        return null;
      return (
        instance.asset &&
        math.pointToUV(
          [
            ((event.clientX - rect.left) * 1000) / rect.width,
            ((event.clientY - rect.top) * 1000) / rect.height,
          ],
          instance.asset.projection,
        )
      );
    };
    let drag;
    canvas.addEventListener("pointerdown", (event) => {
      if (!instance.image) return;
      const point = uv(event);
      if (point) {
        drag = {
          point,
          x: instance.state.placements[instance.product().id].x,
          y: instance.state.placements[instance.product().id].y,
        };
        canvas.setPointerCapture(event.pointerId);
        canvas.focus();
        event.preventDefault();
      }
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const point = uv(event);
      if (!point) return;
      const p = instance.state.placements[instance.product().id];
      p.x = Math.max(0, Math.min(1, drag.x + point.x - drag.point.x));
      p.y = Math.max(0, Math.min(1, drag.y + point.y - drag.point.y));
      instance.update();
      for (const key of ["x", "y"])
        root.querySelector("[data-placement=" + key + "]").value = Math.round(
          p[key] * 100,
        );
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
      canvas.addEventListener(name, () => (drag = null));
    canvas.addEventListener("keydown", (event) => {
      const move = {
        ArrowLeft: [-0.01, 0],
        ArrowRight: [0.01, 0],
        ArrowUp: [0, -0.01],
        ArrowDown: [0, 0.01],
      }[event.key];
      if (!move || !instance.image) return;
      event.preventDefault();
      const p = instance.state.placements[instance.product().id];
      p.x = Math.max(0, Math.min(1, p.x + move[0] * (event.shiftKey ? 5 : 1)));
      p.y = Math.max(0, Math.min(1, p.y + move[1] * (event.shiftKey ? 5 : 1)));
      instance.syncControls();
      instance.update();
    });
    instance.syncControls();
    instance.update();
    const source =
      root
        .closest("form")
        ?.querySelector("#upload-preview img")
        ?.getAttribute("src") || root.dataset.source;
    if (source)
      await instance.loadSource(
        source,
        root.dataset.artworkId || instance.state.artwork_id,
      );
    root.dataset.ready = "true";
  } catch (error) {
    root.querySelector(".studio-canvas-status").textContent = t(error.message);
  }
}
function restoreDesignStudios() {
  for (const root of document.querySelectorAll(".design-studio")) {
    const instance = studioInstances.get(root);
    if (!instance?.state) {
      root.dataset.restoreState = root.querySelector(
        "[name=design_studio]",
      ).value;
      continue;
    }
    try {
      const state = JSON.parse(
        root.querySelector("[name=design_studio]").value,
      );
      if (state?.template_version === instance.config.version) {
        instance.state = state;
        instance.syncControls();
        instance.update();
      }
    } catch {}
  }
  syncDesignPreview();
}
function syncDesignPreview() {
  for (const root of document.querySelectorAll(".design-studio")) {
    if (!studioInstances.has(root)) {
      startDesignStudio(root);
      continue;
    }
    const instance = studioInstances.get(root),
      source = root
        .closest("form")
        ?.querySelector("#upload-preview img")
        ?.getAttribute("src");
    if (source && instance.loadSource && source !== instance.source)
      instance.loadSource(
        source,
        uploadId ||
          root.closest("form").querySelector("[name=upload_id]")?.value,
      );
  }
}
async function prepareDesignStudioSubmission(form, p) {
  const root = form.querySelector(".design-studio");
  if (!root) return;
  const instance = studioInstances.get(root);
  if (!instance?.state) throw Error("Preview templates could not be loaded.");
  instance.state.artwork_id = p.upload_id || null;
  instance.persist();
  p.design_studio = JSON.parse(
    form.querySelector("[name=design_studio]").value,
  );
  delete p.use_mockup_preview;
  if (
    p.upload_id &&
    form.querySelector("[name=use_mockup_preview]").checked &&
    mode !== "demo"
  ) {
    form.querySelector("#upload-status").textContent = t(
      "Preparing your product mockup...",
    );
    const result = await api("design-mockup", {
      id: p.id,
      upload_id: p.upload_id,
      category: p.category,
      design_studio: p.design_studio,
    });
    p.mockup_upload_id = result.mockup_upload_id;
  } else p.mockup_upload_id = null;
}
function sendArtworkUpload(file, form, progress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api.php?route=upload");
    xhr.setRequestHeader("X-CSRF-Token", csrf);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        progress.hidden = false;
        progress.value = (event.loaded / event.total) * 100;
      }
    };
    xhr.onload = () => {
      try {
        const result = JSON.parse(xhr.responseText);
        if (xhr.status < 200 || xhr.status >= 300)
          throw Error(result.error || "Upload failed.");
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    xhr.onerror = () => reject(Error("Upload failed."));
    xhr.onabort = () => reject(Error("Upload cancelled."));
    const data = new FormData();
    data.append("artwork", file);
    xhr.send(data);
  });
}
document.addEventListener("change", async (event) => {
  if (event.target.id !== "artwork-file") return;
  const input = event.target,
    file = input.files[0],
    form = input.closest("form");
  if (!file || form.dataset.artworkBusy) return;
  const status = form.querySelector("#upload-status"),
    preview = form.querySelector("#upload-preview"),
    progress = form.querySelector("progress");
  form.dataset.artworkBusy = "1";
  try {
    if (
      !["image/png", "image/jpeg"].includes(file.type) ||
      file.size > 25 * 1024 * 1024
    )
      throw Error("Choose a PNG or JPEG up to 25 MB.");
    status.textContent = t("Uploading your artwork...");
    let result, data;
    if (mode === "demo") {
      data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      result = { upload_id: id("art-") };
      dbLocal.uploads[result.upload_id] = data;
      persist();
    } else {
      result = await sendArtworkUpload(file, form, progress);
      data = "/api.php?route=image&id=" + encodeURIComponent(result.upload_id);
    }
    if (!form.isConnected) return;
    uploadId = result.upload_id;
    const hidden = form.querySelector("[name=upload_id]");
    if (hidden) hidden.value = uploadId;
    preview.innerHTML = `<img class="upload-preview" src="${esc(data)}" alt="${t("Your uploaded artwork")}">`;
    status.textContent = t("Artwork ready. Add the details below.");
    const root = form.querySelector(".design-studio");
    if (root) {
      root.dataset.artworkId = uploadId;
      await studioInstances.get(root)?.loadSource?.(data, uploadId);
    }
    if (result.artwork) setDesignStudioMetadata(result.artwork, form);
    refreshArtworkMetadata(uploadId);
  } catch (error) {
    if (form.isConnected) {
      status.textContent = localizedError(error.message);
      toast(error.message);
    }
  } finally {
    delete form.dataset.artworkBusy;
    if (progress) progress.hidden = true;
    input.value = "";
  }
});
for (const eventName of ["dragover", "dragleave", "drop"])
  document.addEventListener(eventName, (event) => {
    const zone = event.target.closest("[data-studio-drop]");
    if (!zone) return;
    event.preventDefault();
    zone.classList.toggle("drag-active", eventName === "dragover");
    if (eventName === "drop" && event.dataTransfer?.files.length) {
      if (event.dataTransfer.files.length !== 1) {
        toast(t("Choose one original artwork file."));
        return;
      }
      const input = zone.querySelector("#artwork-file"),
        transfer = new DataTransfer();
      transfer.items.add(event.dataTransfer.files[0]);
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
for (const id of ["app", "modal"])
  new MutationObserver(syncDesignPreview).observe(document.getElementById(id), {
    childList: true,
    subtree: true,
  });
