/* Licensed local fonts. No runtime font-provider requests or eager font loads. */
(() => {
  "use strict";
  let fonts = [], byId = new Map(), names = {};
  // Hostinger caches assets for a year. Follow the version on this script so a
  // newly deployed catalogue cannot be hidden by an older CDN/browser copy.
  const manifestUrl = new URL("/assets/design-fonts.json", location.origin);
  if (document.currentScript?.src)
    manifestUrl.search = new URL(document.currentScript.src, location.origin).search;
  const loaded = new Map(), queue = [];
  let readyPromise;
  let activeLoads = 0;
  const fold = (value) => String(value).normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  const alias = (id) => "Veelad Design " + id;
  const includes = (ranges, point) => {
    let low = 0, high = ranges.length - 1;
    while (low <= high) {
      const middle = (low + high) >>> 1, [start, end] = ranges[middle];
      if (point < start) high = middle - 1;
      else if (point > end) low = middle + 1;
      else return true;
    }
    return false;
  };
  const missingGlyphs = (id, text) => {
    const font = byId.get(id);
    return [...new Set([...String(text).normalize("NFC")].filter((char) =>
      !/[\s\u200b-\u200f\u2066-\u2069\ufe0e\ufe0f]/u.test(char) &&
      (!font || !includes(font.coverage, char.codePointAt(0))),
    ))];
  };
  const drain = () => {
    while (activeLoads < 4 && queue.length) {
      const task = queue.shift();
      activeLoads++;
      task().finally(() => { activeLoads--; drain(); });
    }
  };
  const api = {
    get ready() {
      // This script is shared by shop pages. Fetch the catalogue only when the
      // creative editor first asks for it, and share one promise across callers.
      return readyPromise ||= fetch(manifestUrl.href, { credentials: "same-origin", cache: "force-cache" })
        .then((response) => {
          if (!response.ok) throw new Error("The design font library could not load.");
          return response.json();
        })
        .then((manifest) => {
          if (manifest.version !== 1 || !Array.isArray(manifest.fonts)) throw new Error("Unsupported font catalogue.");
          fonts = manifest.fonts.map((font) => Object.freeze({ ...font, scripts: Object.freeze(font.scripts), coverage: Object.freeze(font.coverage.map(Object.freeze)) }));
          byId = new Map(fonts.map((font) => [font.id, font]));
          names = manifest.script_names;
          return api;
        })
        .catch((error) => {
          readyPromise = undefined;
          throw error;
        });
    },
    catalogue: () => fonts.slice(),
    scriptNames: () => ({ ...names }),
    get: (id) => byId.get(id) || null,
    cssFamily: (id) => byId.has(id) ? alias(id) : "sans-serif",
    missingGlyphs,
    supports: (id, text) => byId.has(id) && missingGlyphs(id, text).length === 0,
    search: (query = "", { script = "", category = "" } = {}) => {
      const words = fold(query).trim().split(/\s+/u).filter(Boolean);
      return fonts.filter((font) => (!script || font.scripts.includes(script)) &&
        (!category || font.category === category) && words.every((word) =>
          fold([font.label, font.id, font.category, ...font.scripts.flatMap((code) => [code, names[code] || ""])].join(" ")).includes(word),
        ));
    },
    load: (id) => {
      if (loaded.has(id)) return loaded.get(id);
      const pending = api.ready.then(() => new Promise((resolve, reject) => {
        const font = byId.get(id);
        if (!font) { reject(new TypeError("Unknown design font.")); return; }
        queue.push(async () => {
          try {
            const face = new FontFace(alias(id), `url("/assets/fonts/${font.file}?v=${font.sha256.slice(0, 16)}")`, { weight: String(font.weight), style: "normal", display: "swap" });
            await face.load();
            document.fonts.add(face);
            resolve(alias(id));
          } catch (error) { loaded.delete(id); reject(error); }
        });
        drain();
      }));
      loaded.set(id, pending);
      // A failed manifest load should allow a future caller to retry explicitly.
      pending.catch(() => loaded.delete(id));
      return pending;
    },
  };
  window.VeeladFonts = Object.freeze(api);
})();
