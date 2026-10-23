/* Private layered designs. Coordinates and glyphs match the production renderer. */
"use strict";
const customerSceneVersion = "veelad-scene-1";
const customerSurface = (type, view) => type === "mug" ? "wrap" : type === "shirt" && view === "shirt-back" ? "back" : "front";
function customerSceneText(layer) {
  // Old single-image designs used an Arabic fallback for these two Latin fonts.
  // Make that choice explicit when moving old content into the new workspace.
  const font = ['manrope', 'dm-sans'].includes(layer.font) && /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u.test(layer.text) ? 'arabic' : layer.font;
  return { ...layer, font, type: 'text', opacity: layer.opacity ?? 1, visible: layer.visible !== false, locked: layer.locked === true };
}
function customerScene(instance, type = instance.product().id, surface) {
  const side = surface || customerSurface(type, instance.state.placements[type]?.view);
  instance.state.scenes ||= {};
  instance.state.scenes[type] ||= {};
  return instance.state.scenes[type][side] ||= { background: "transparent", layers: [] };
}
function customerSceneImages(state) {
  return [...new Set(Object.values(state.scenes || {}).flatMap((surfaces) => Object.values(surfaces).flatMap((scene) => scene.layers.filter((layer) => layer.type === "image").map((layer) => layer.upload_id))))];
}
function customerSceneLayerCount(state) {
  return Object.values(state.scenes || {}).reduce((count, surfaces) => count + Object.values(surfaces).reduce((sum, scene) => sum + scene.layers.length, 0), 0);
}
function customerSceneHasContent(state, type, surface) {
  if (surface) {
    const scene = state.scenes?.[type]?.[surface];
    return !!scene && (scene.background !== 'transparent' || scene.layers.some(layer => layer.visible !== false && (layer.opacity ?? 1) > 0 && (layer.type === 'image' || layer.text.trim())));
  }
  return Object.values(type ? state.scenes?.[type] || {} : state.scenes || {}).some((entry) => {
    const scenes = type ? [entry] : Object.values(entry);
    return scenes.some((scene) => scene.background !== "transparent" || scene.layers.some((layer) => layer.visible !== false && (layer.opacity ?? 1) > 0 && (layer.type === "image" || layer.text.trim())));
  });
}
async function mountCustomerScenes(instance) {
  const root = instance.root, form = root.closest('[data-form="customer-design"]');
  if (!form || instance.sceneEditor) return;
  const images = new Map(), glyphs = new Map(), metadata = new Map();
  if (instance.image && instance.state.artwork_id) images.set(instance.state.artwork_id, Promise.resolve(instance.image));
  // Upgrade only the private customer editor. Historical orders and artist listings
  // retain their original renderer, and existing placements are preserved exactly.
  if (instance.state.scene_version !== customerSceneVersion) {
    instance.state.scene_version = customerSceneVersion;
    instance.state.scenes = {};
    for (const product of instance.config.products) {
      const placement = instance.state.placements[product.id], scene = customerScene(instance, product.id);
      scene.background = placement.background;
      if (instance.image && instance.state.artwork_id) {
        const cw = 900, ch = 900 * product.preview[1] / product.preview[0];
        const layout = instance.math.imageLayout(instance.image.naturalWidth, instance.image.naturalHeight, cw, ch, placement);
        scene.layers.push({ id: id('image-'), type: 'image', upload_id: instance.state.artwork_id, x: placement.x, y: placement.y, width: layout.width / cw, height: layout.height / ch, rotation: placement.rotation, repeat: placement.repeat, opacity: 1, visible: true, locked: false });
      }
      for (const layer of instance.state.text_layers?.[product.id] || []) scene.layers.push(customerSceneText(layer));
    }
  }
  const syncPrimary = () => {
    const ids = customerSceneImages(instance.state), current = instance.state.artwork_id;
    const primary = ids.includes(current) ? current : ids[0] || null;
    instance.state.artwork_id = primary;
    uploadId = primary;
    form.elements.upload_id.value = primary || '';
    root.dataset.artworkId = primary || '';
  };
  const image = (upload) => {
    if (!images.has(upload)) {
      const work = (async () => {
        const img = new Image();
        img.src = '/api.php?' + new URLSearchParams({ route: 'image', id: upload });
        await img.decode();
        return img;
      })();
      images.set(upload, work);
      work.catch(() => images.delete(upload));
    }
    return images.get(upload);
  };
  const originalMetadata = (upload) => {
    if (!metadata.has(upload)) {
      const work = api('artwork-metadata', null, { id: upload }).then(data => data.artwork);
      metadata.set(upload, work);
      work.catch(() => metadata.delete(upload));
    }
    return metadata.get(upload);
  };
  const glyph = (layer) => {
    const key = textGlyphKey([layer]);
    if (!glyphs.has(key)) {
      const work = (async () => {
        const response = await api('customer-text-preview', { category: instance.product().category, scene_version: customerSceneVersion, layers: [layer] });
        if (!response.layers[0]?.image) return null;
        const img = new Image(); img.src = response.layers[0].image; await img.decode(); return img;
      })();
      glyphs.set(key, work);
      while (glyphs.size > 100) glyphs.delete(glyphs.keys().next().value);
      work.catch(() => { if (glyphs.get(key) === work) glyphs.delete(key); });
    }
    return glyphs.get(key);
  };
  const commit = () => {
    syncPrimary();
    instance.textReadyKey = '';
    instance.update();
    instance.workspace?.refresh?.();
  };
  const addImages = async (files) => {
    if (form.dataset.artworkBusy) throw Error(t('Wait for your artwork upload to finish.'));
    const list = Array.from(files || []), scene = customerScene(instance), added = [];
    if (!list.length) return added;
    if (scene.layers.length + list.length > 24) throw Error(t('Use up to 24 layers on each side.'));
    if (customerSceneLayerCount(instance.state) + list.length > 120) throw Error(t('Use up to 120 layers across your product designs.'));
    if (customerSceneImages(instance.state).length + list.length > 16) throw Error(t('Use up to 16 different images in one design.'));
    for (const file of list) if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 25 * 1024 * 1024) throw Error(t('Choose a PNG or JPEG up to 25 MB.'));
    form.dataset.artworkBusy = '1';
    const status = form.querySelector('#upload-status'), progress = form.querySelector('.studio-upload-progress');
    const product = instance.product(), side = customerSurface(product.id, instance.state.placements[product.id].view);
    try {
      for (let n = 0; n < list.length; n++) {
        if (status) status.textContent = t('Uploading your artwork...') + ` ${n + 1}/${list.length}`;
        const result = await sendArtworkUpload(list[n], form, progress);
        if (!form.isConnected) return added;
        const img = await image(result.upload_id), cw = 900, ch = cw * product.preview[1] / product.preview[0];
        if (result.artwork) metadata.set(result.upload_id, Promise.resolve(result.artwork));
        const fit = Math.min(cw * .74 / img.naturalWidth, ch * .74 / img.naturalHeight);
        const layer = { id: id('image-'), type: 'image', upload_id: result.upload_id, x: .5, y: .5, width: img.naturalWidth * fit / cw, height: img.naturalHeight * fit / ch, rotation: 0, repeat: false, opacity: 1, visible: true, locked: false };
        customerScene(instance, product.id, side).layers.push(layer);
        added.push(layer);
        // Commit each completed upload, so a subsequent network failure never
        // discards images that have already arrived successfully.
        commit();
      }
      if (status) status.textContent = t('Artwork ready. Add the details below.');
      return added;
    } finally {
      delete form.dataset.artworkBusy;
      if (progress) progress.hidden = true;
    }
  };
  instance.sceneEditor = {
    scene: () => customerScene(instance),
    layers: () => customerScene(instance).layers,
    surface: () => customerSurface(instance.product().id, instance.state.placements[instance.product().id].view),
    surfaces: () => instance.product().id === 'shirt' ? [{ id: 'front', label: t('Front') }, { id: 'back', label: t('Back') }] : [{ id: instance.product().id === 'mug' ? 'wrap' : 'front', label: t(instance.product().id === 'mug' ? 'Wrap' : 'Front') }],
    setSurface: (surface) => {
      const product = instance.product();
      if (product.id === 'shirt' && ['front', 'back'].includes(surface)) instance.state.placements.shirt.view = surface === 'back' ? 'shirt-back' : 'shirt';
      customerScene(instance);
      instance.syncControls();
      commit();
    },
    image, glyph, addImages, commit, metadata: originalMetadata,
    quality: async () => {
      const product = instance.product(), warnings = [];
      for (const layer of customerScene(instance).layers) {
        if (layer.visible === false || layer.opacity === 0) continue;
        const img = layer.type === 'image' ? await image(layer.upload_id) : await glyph(layer);
        if (!img) continue;
        const cw = 900, ch = cw * product.preview[1] / product.preview[0];
        const w = layer.type === 'image' ? layer.width : img.naturalWidth / cw, h = layer.type === 'image' ? layer.height : img.naturalHeight / ch;
        const a = layer.rotation * Math.PI / 180, bw = Math.abs(Math.cos(a)) * w + Math.abs(Math.sin(a)) * h * ch / cw, bh = Math.abs(Math.sin(a)) * w * cw / ch + Math.abs(Math.cos(a)) * h;
        if (!layer.repeat && (layer.x - bw / 2 < .05 || layer.x + bw / 2 > .95 || layer.y - bh / 2 < .05 || layer.y + bh / 2 > .95)) warnings.push(t('Part of your design is near or outside the safe area.'));
        if (layer.type === 'image' && product.canvas) {
          const native = await originalMetadata(layer.upload_id);
          const dpi = Math.floor(Math.min(native.width / (w * product.canvas[0] / 300), native.height / (h * product.canvas[1] / 300)));
          if (dpi < 150) warnings.push(t('An image may look soft at this size. Use a larger original or make it smaller.'));
        }
      }
      return [...new Set(warnings)];
    },
  };
  // Old text tools and starter layouts use this bridge; layers stay in one
  // authoritative scene rather than two competing representations.
  instance.replaceSceneText = (layers) => {
    const scene = customerScene(instance);
    const kept = scene.layers.filter((layer) => layer.type !== 'text');
    if (kept.length + layers.length > 24) throw Error(t('Use up to 24 layers on each side.'));
    if (customerSceneLayerCount(instance.state) - scene.layers.length + kept.length + layers.length > 120) throw Error(t('Use up to 120 layers across your product designs.'));
    scene.layers = [...kept, ...layers.map(customerSceneText)];
    commit();
  };
  syncPrimary();
  await mountCustomerWorkspace(instance);
  instance.persist();
}
async function customerSceneTexture(instance, product) {
  const scene = customerScene(instance, product.id), canvas = document.createElement('canvas');
  canvas.width = 900; canvas.height = Math.round(900 * product.preview[1] / product.preview[0]);
  const ctx = canvas.getContext('2d'), layers = scene.layers.filter((layer) => layer.visible !== false && layer.opacity > 0);
  const key = textGlyphKey(layers.filter((layer) => layer.type === 'text'));
  instance.root.dataset.textBusy = 'true';
  try {
    if (scene.background !== 'transparent') { ctx.fillStyle = scene.background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    for (const layer of layers) {
      const img = layer.type === 'image' ? await instance.sceneEditor.image(layer.upload_id) : await instance.sceneEditor.glyph(layer);
      if (!img) continue;
      const w = layer.type === 'image' ? layer.width * canvas.width : img.naturalWidth, h = layer.type === 'image' ? layer.height * canvas.height : img.naturalHeight;
      const angle = layer.rotation * Math.PI / 180;
      const layout = { x: layer.x * canvas.width, y: layer.y * canvas.height, width: w, height: h, angle, bounds: { width: Math.abs(Math.cos(angle)) * w + Math.abs(Math.sin(angle)) * h, height: Math.abs(Math.sin(angle)) * w + Math.abs(Math.cos(angle)) * h } };
      const centers = instance.math.patternCenters(layout, canvas.width, canvas.height, layer.type === 'image' && layer.repeat);
      if (!centers) throw Error(t('The pattern is too dense. Increase its scale or use a single placement.'));
      for (const center of centers) {
        ctx.save(); ctx.globalAlpha = layer.opacity ?? 1; ctx.translate(center.x, center.y); ctx.rotate(angle); ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
      }
    }
    const active = customerScene(instance).layers.filter((layer) => layer.type === 'text' && layer.visible !== false && layer.opacity > 0);
    if (textGlyphKey(active) === key) { instance.textReadyKey = key; delete instance.root.dataset.textBusy; }
    return canvas;
  } catch (error) { delete instance.root.dataset.textBusy; throw error; }
}
