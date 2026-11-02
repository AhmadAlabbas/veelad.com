/* A private, layered creative workspace. Print glyphs come from the production renderer. */
"use strict";
const workspaceArabic = {
  "Editable graphics, emojis, flags and city badges. Emoji and flag symbols keep their original colours; decoration can be recoloured.":"رسومات ورموز تعبيرية وأعلام وشارات مدن. تحتفظ الإيموجي والأعلام بألوانها الأصلية ويمكن تغيير ألوان الزينة.", "Emoji and flag symbols retain their colours. Change the badge colours instead.":"تحتفظ الإيموجي والأعلام بألوانها. غيّر ألوان الإطار أو الزينة بدلاً منها.", "Original national flag and emoji colours cannot be changed.":"لا يمكن تغيير الألوان الأصلية للعلم أو الإيموجي.", "Choose a decorated style to customise this symbol.":"اختر شكلاً مزخرفاً لتغيير ألوان خلفية هذا الرمز.",
  "Place artwork within the provisional safe region. Final supplier dimensions are not yet approved.":"ضع التصميم داخل المنطقة الآمنة المبدئية. لم تُعتمد مقاسات المورد النهائية.", "Artwork approaches the provisional print boundary; check supplier-safe placement.":"التصميم قريب من حدود الطباعة المبدئية؛ تحقق من منطقة طباعة المورد.", "Some artwork is very small on the canvas; confirm its print size.":"بعض الرسوم صغيرة جدًا على اللوحة؛ راجع حجم الطباعة.", "An empty text layer will not print.":"لن تتم طباعة طبقة النص الفارغة.", "Align to safe left":"حاذِ لليسار الآمن", "Align to safe right":"حاذِ لليمين الآمن", "Align to safe top":"حاذِ للأعلى الآمن", "Align to safe bottom":"حاذِ للأسفل الآمن",
  "My favourites":"المفضلة", "Recently used":"المستخدمة مؤخرًا", "Explore all":"استكشف الكل", "Curated collection":"مجموعة مختارة", "Apply design":"طبّق التصميم", "Ready-made designs":"تصاميم جاهزة", "Original editable starting points":"قوالب أصلية قابلة للتعديل", "Print positioning":"موضع الطباعة", "Print preflight":"فحص الطباعة",
  "Elements":"العناصر", "Element":"عنصر", "Search elements":"ابحث عن العناصر", "All categories":"كل التصنيفات", "More elements":"المزيد من العناصر", "Element colours":"ألوان العنصر", "Primary":"الأساسي", "Secondary":"الثانوي", "Accent":"التفاصيل", "Preparing element…":"نجهّز العنصر…", "Element updated":"تم تعديل العنصر", "Elements are original and can be recoloured.":"عناصر أصلية ويمكنك تغيير ألوانها.",
  "Move, resize and rotate design on product":"حرّك التصميم على المنتج وغيّر حجمه ودوّره", "Select artwork on the product to drag, resize or rotate it.":"اختر التصميم على القطعة واسحبه أو غيّر حجمه أو دوّره.", "Rotate selected artwork":"تدوير العنصر المحدد", "Resize selected artwork":"تغيير حجم العنصر المحدد",
  "Move artwork on the garment or edit it on the flat canvas.":"حرّك العناصر مباشرة على القطعة أو عدّلها على مساحة التصميم المسطحة.",
  "Drag to reorder. Alt+Shift+Arrow keys also work.":"اسحب لإعادة ترتيب الطبقات، أو استخدم Alt+Shift مع الأسهم.", "Layer order updated":"تم تحديث ترتيب الطبقات",
  "Save these colours":"حفظ هذه الألوان","Colours from photo":"ألوان من الصورة","Palette saved locally":"تم حفظ لوحة الألوان محليًا","Extracting palette locally…":"جارٍ استخراج الألوان محليًا…","Palette applied":"تم تطبيق لوحة الألوان","Could not extract colours from this photo.":"تعذر استخراج الألوان من هذه الصورة.",
  "Creative studio":"استوديو التصميم", "Make room for your imagination.":"خلّ لخيالك مساحة.", "Design":"التصميم", "Product preview":"معاينة القطعة", "Review item":"راجع قطعتك", "Uploads":"الصور", "Text":"النصوص", "Fonts":"الخطوط", "Layers":"الطبقات", "Layouts":"القوالب", "Canvas":"لوحة التصميم", "Add images":"أضف صور", "Upload images":"ارفع صورك", "Drop your images here":"اسحب صورك هنا", "PNG or JPEG · multiple files welcome":"PNG أو JPEG · تقدر تضيف أكثر من صورة", "Your originals stay private.":"ملفاتك الأصلية تبقى خاصة فيك.", "Add text":"أضف نص", "Add a heading":"أضف عنوان", "Add a little detail":"أضف عبارة صغيرة", "Your words, your style.":"كلماتك، بأسلوبك.", "Mix languages, play with type, make it yours.":"اجمع أكثر من لغة، وجرّب الخطوط على ذوقك.", "Write something wonderful":"اكتب شيء يشبهك", "A little more you":"تفصيلة منك", "Search fonts":"ابحث عن خط", "All scripts":"كل اللغات", "All styles":"كل الأنماط", "No fonts match. Try another search.":"ما لقينا خط يطابق بحثك. جرّب كلمة ثانية.", "Choose text on the canvas to apply a font.":"اختر نص من اللوحة عشان تغيّر خطه.", "Loading fonts…":"نجهّز مكتبة الخطوط…", "Font library is unavailable. Try again shortly.":"مكتبة الخطوط غير متاحة حاليًا. جرّب بعد شوي.", "Some characters are not included in this font. Choose a font for this script.":"بعض الحروف مو موجودة في هالخط. اختر خط يدعم لغة النص.", "Front":"الأمام", "Back":"الخلف", "Wrap":"التصميم الكامل", "Independent designs on each side":"تصميم مستقل لكل جهة", "One continuous wrap":"تصميم واحد يلتف حول الكوب", "Undo":"تراجع", "Redo":"إعادة", "Zoom":"التكبير", "Fit":"ملاءمة", "Fit to screen":"ناسب حجم الشاشة", "Safe area":"المساحة الآمنة", "Snap to centre":"محاذاة للمنتصف", "Snap to guides":"محاذاة ذكية مع العناصر وحدود اللوحة", "Add a photo. Make a statement.":"صورة منك. وتصميم على ذوقك.", "Start with an image, a few words, or both.":"ابدأ بصورة، أو كلمات، أو اجمعهم مع بعض.", "Select a layer to fine-tune it.":"اختر طبقة عشان تعدّل تفاصيلها.", "Drag to move · corners to resize · top handle to rotate":"اسحب للتحريك · الزوايا لتغيير الحجم · المقبض العلوي للتدوير", "Shift: straight line · Alt: ignore guides · Esc: cancel":"Shift: حركة مستقيمة · Alt: تجاهل المحاذاة · Esc: إلغاء", "Drag to move. Use the corner handles to resize.":"اسحب للتحريك. واستخدم مقابض الزوايا لتغيير الحجم.", "Provisional product preview":"معاينة مبدئية للقطعة", "Your design is editable. Supplier print specifications still need confirmation.":"تصميمك قابل للتعديل. مقاسات الطباعة النهائية تحتاج تأكيد المورّد.", "Background":"الخلفية", "Transparent":"شفافة", "Colour":"اللون", "Opacity":"الشفافية", "Rotation":"الدوران", "Width (%)":"العرض (%)", "Height (%)":"الارتفاع (%)", "Horizontal (%)":"أفقي (%)", "Vertical (%)":"عمودي (%)", "Text size (%)":"حجم النص (%)", "Your text":"النص", "Font":"الخط", "Writing direction":"اتجاه الكتابة", "Automatic":"تلقائي", "Right to left":"من اليمين لليسار", "Left to right":"من اليسار لليمين", "Alignment":"المحاذاة", "Left":"يسار", "Centre":"وسط", "Right":"يمين", "Duplicate":"انسخ", "Delete":"احذف", "Move forward":"قدّم طبقة", "Move backward":"أخّر طبقة", "Centre horizontally":"وسّط أفقيًا", "Centre vertically":"وسّط عموديًا", "Flip horizontally":"اعكس أفقيًا", "Flip vertically":"اعكس عموديًا", "Show layer":"أظهر الطبقة", "Hide layer":"أخفِ الطبقة", "Unlock layer":"افتح قفل الطبقة", "Lock layer":"اقفل الطبقة", "Image":"صورة", "Text layer":"طبقة نص", "No layers yet":"لوحتك جاهزة لأفكارك", "Add images or text. Every element stays editable.":"أضف صور أو نصوص. كل عنصر يبقى قابل للتعديل.", "Selected layer":"الطبقة المختارة", "Layer is locked. Unlock it to edit.":"الطبقة مقفلة. افتح القفل عشان تعدّلها.", "Your own text":"كلماتك هنا", "Add up to 24 layers on each side.":"تقدر تضيف حتى 24 طبقة لكل جهة.", "Preparing your images…":"نجهّز صورك…", "Images added":"أضفنا الصور", "Could not load this layer.":"ما قدرنا نحمّل هالطبقة.", "Preparing accurate text…":"نجهّز النص بدقّة…", "Close panel":"أغلق الأدوات", "Open panel":"افتح الأدوات", "Keyboard: arrows to move, Shift for larger steps, Delete to remove.":"بالكيبورد: الأسهم للتحريك، وShift لخطوة أكبر، وDelete للحذف.", "This side is empty":"هالجهة فاضية", "Layer":"طبقة", "Ready to create":"جاهز لأفكارك", "Image quality is checked again before printing.":"جودة الصور تنفحص مرة ثانية قبل الطباعة.", "Print safe area":"حدود الطباعة الآمنة", "Shown above the layer below it":"تظهر فوق الطبقة اللي تحتها", "Your image":"صورتك", "Keep proportions":"حافظ على النسبة", "Edit on a flat canvas, then preview your item.":"عدّل على لوحة مسطّحة، وبعدها شوف التصميم على قطعتك.", "Choose a layout":"اختر قالب", "No layouts available":"القوالب غير متاحة حاليًا", "Sample text":"نص تجريبي", "Layers on this side":"طبقات هالجهة", "Changes save automatically":"تعديلاتك تنحفظ تلقائيًا", "Move and resize artwork":"حرّك التصميم وغيّر حجمه", "Printing area":"مساحة الطباعة", "Load more fonts":"اعرض خطوط أكثر", "Font style":"نمط الخط", "sans":"بسيط", "serif":"كلاسيكي", "display":"عناوين", "handwriting":"يدوي", "mono":"متساوي العرض", "arabic":"عربي", "Image uploads are private and stay linked to this design.":"صورك خاصة وتبقى مرتبطة بهالتصميم.", "Choose a font":"اختر خط", "Uploading":"جارٍ الرفع", "Template applied":"أضفنا القالب", "Preview":"معاينة", "No artwork on this side yet.":"ما فيه تصميم على هالجهة للحين."
};
function workspaceT(value) {
  return typeof currentLanguage === "function" && currentLanguage() === "ar"
    ? workspaceArabic[value] || t(value)
    : t(value);
}
function workspaceIcon(name) {
  const shapes = {
    upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
    text:'<path d="M4 5V3h16v2M12 3v18m-4 0h8"/>',
    fonts:'<path d="m3 20 6-16 6 16M5 15h8m3-2c0-4 6-4 6 0v7m0-5h-3c-4 0-4 5 0 5h3"/>',
    layers:'<path d="m12 3 10 6-10 6L2 9l10-6Zm-9 12 9 6 9-6M3 12l9 6 9-6"/>',
    layouts:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m0-11h12"/>',
    canvas:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m7 15 3-4 3 3 4-6"/>',
    undo:'<path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 7 7v4"/>',
    redo:'<path d="m16 4 5 5-5 5m5-5H11a7 7 0 0 0-7 7v4"/>',
    eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    hidden:'<path d="m3 3 18 18M9 5c7-2 13 7 13 7s-2 4-5 5M6 6c-3 2-4 6-4 6s4 7 10 7c1 0 2 0 3-1"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    unlock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7-3"/>',
    duplicate:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    delete:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    up:'<path d="m5 14 7-7 7 7"/>',down:'<path d="m5 10 7 7 7-7"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    plus:'<path d="M12 4v16M4 12h16"/>',
    search:'<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
    centre:'<path d="M12 2v20M2 12h20"/><rect x="6" y="6" width="12" height="12" rx="2"/>',
    rotate:'<path d="M4 10a8 8 0 1 1 2 8M4 4v6h6"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
    sparkle:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"/>',
    expand:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>'
  };
  return `<svg class="cw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name] || shapes.canvas}</svg>`;
}
function mountCustomerWorkspace(instance) {
  if (!instance?.sceneEditor || instance.workspace || !instance.root.closest("[data-form=customer-design]")) return;
  const root=instance.root, form=root.closest("form"), adapter=instance.sceneEditor,
    tr=workspaceT, uid=()=>typeof id==="function"?id("layer-"):"layer-"+crypto.randomUUID(),
    cloneState=value=>JSON.parse(JSON.stringify(value)), clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  root.classList.add("has-creative-workspace");
  const shell=document.createElement("section");
  shell.className="customer-workspace";
  shell.setAttribute("aria-label",tr("Creative studio"));
  const tools=[["uploads","upload","Uploads"],["elements","sparkle","Elements"],["text","text","Text"],["fonts","fonts","Fonts"],["layers","layers","Layers"],["layouts","layouts","Layouts"],["canvas","canvas","Canvas"]];
  const action=(name,label,symbol,extra="")=>`<button type="button" class="cw-icon-button" data-ws-action="${name}" title="${esc(tr(label))}" aria-label="${esc(tr(label))}" ${extra}>${workspaceIcon(symbol)}</button>`;
  shell.innerHTML=`<header class="cw-header"><div class="cw-studio-title"><span class="cw-brand-mark">${workspaceIcon("sparkle")}</span><div><h3>${tr("Creative studio")}</h3><span>${tr("Make room for your imagination.")}</span></div></div><div class="cw-history">${action("undo","Undo","undo","disabled")}${action("redo","Redo","redo","disabled")}</div><div class="cw-mode-switch" role="group" aria-label="${esc(tr("Preview"))}"><button type="button" data-ws-mode="edit" aria-pressed="true">${tr("Design")}</button><button type="button" data-ws-mode="preview" aria-pressed="false">${tr("Product preview")}</button></div><button type="button" class="cw-review-button" data-ws-review>${tr("Review item")} <span aria-hidden="true">↗</span></button></header><div class="cw-layout"><nav class="cw-tool-rail" aria-label="${esc(tr("Editing tools"))}">${tools.map(([key,symbol,label],i)=>`<button type="button" data-ws-tool="${key}" aria-pressed="${i===0}" aria-controls="cw-panel-${key}">${workspaceIcon(symbol)}<span>${tr(label)}</span></button>`).join("")}</nav><aside class="cw-panel"><header class="cw-panel-header"><h4 data-ws-panel-title>${tr("Uploads")}</h4><button type="button" class="cw-icon-button cw-panel-close" data-ws-close-panel aria-label="${esc(tr("Close panel"))}">${workspaceIcon("close")}</button></header><div class="cw-panel-content"><section class="cw-tool-panel" id="cw-panel-uploads" data-ws-panel="uploads"><label class="cw-upload-drop" data-ws-drop>${workspaceIcon("upload")}<strong>${tr("Drop your images here")}</strong><span>${tr("PNG or JPEG · multiple files welcome")}</span><span class="cw-button cw-button-primary">${tr("Upload images")}</span><input type="file" accept="image/png,image/jpeg" multiple data-ws-upload aria-label="${esc(tr("Upload images"))}"></label><p class="cw-private-note">${workspaceIcon("lock")}${tr("Your originals stay private.")}</p><div class="cw-upload-library" data-ws-upload-library></div><p class="cw-muted">${tr("Image quality is checked again before printing.")}</p></section><section class="cw-tool-panel" id="cw-panel-text" data-ws-panel="text" hidden><p class="cw-panel-intro">${tr("Your words, your style.")}</p><p class="cw-muted">${tr("Mix languages, play with type, make it yours.")}</p><button type="button" class="cw-text-preset cw-text-heading" data-ws-add-text="heading">${tr("Add a heading")}</button><button type="button" class="cw-text-preset" data-ws-add-text="body">${tr("Add text")}</button><button type="button" class="cw-text-preset cw-text-detail" data-ws-add-text="detail">${tr("Add a little detail")}</button><button type="button" class="cw-font-library-link" data-ws-open-fonts>${workspaceIcon("fonts")}${tr("Choose a font")} <span aria-hidden="true">↗</span></button></section><section class="cw-tool-panel" id="cw-panel-fonts" data-ws-panel="fonts" hidden><label class="cw-font-search">${workspaceIcon("search")}<input type="search" data-ws-font-search placeholder="${esc(tr("Search fonts"))}" aria-label="${esc(tr("Search fonts"))}"></label><div class="cw-font-filters"><select data-ws-font-script aria-label="${esc(tr("All scripts"))}"><option value="">${tr("All scripts")}</option></select><select data-ws-font-category aria-label="${esc(tr("Font style"))}"><option value="">${tr("All styles")}</option>${["arabic","sans","serif","display","handwriting","mono"].map(style=>`<option value="${style}">${tr(style)}</option>`).join("")}</select></div><p class="cw-muted" data-ws-font-hint>${tr("Choose text on the canvas to apply a font.")}</p><div class="cw-font-results" data-ws-font-results role="listbox" aria-label="${esc(tr("Fonts"))}"><p class="cw-muted">${tr("Loading fonts…")}</p></div></section><section class="cw-tool-panel" id="cw-panel-layers" data-ws-panel="layers" hidden><p class="cw-muted">${tr("Shown above the layer below it")}</p><div class="cw-layer-list" data-ws-layer-list></div></section><section class="cw-tool-panel" id="cw-panel-layouts" data-ws-panel="layouts" hidden><p class="cw-panel-intro">${tr("Choose a layout")}</p><div data-ws-layouts></div></section><section class="cw-tool-panel" id="cw-panel-canvas" data-ws-panel="canvas" hidden><p class="cw-panel-intro">${tr("Background")}</p><label class="cw-check"><input type="checkbox" data-ws-transparent checked>${tr("Transparent")}</label><label class="cw-colour-field"><span>${tr("Colour")}</span><input type="color" data-ws-background value="#ffffff"></label><hr><label class="cw-check"><input type="checkbox" data-ws-guides checked>${tr("Print safe area")}</label><label class="cw-check"><input type="checkbox" data-ws-snap checked>${tr("Snap to guides")}</label><p class="cw-muted">${tr("Your design is editable. Supplier print specifications still need confirmation.")}</p></section><section class="cw-inspector" data-ws-inspector></section></div></aside><div class="cw-stage-column"><div class="cw-stage-toolbar"><div class="cw-surface-tabs" data-ws-surfaces role="group" aria-label="${esc(tr("Printing area"))}"></div><span class="cw-surface-note" data-ws-surface-note></span><label class="cw-zoom-control"><span>${tr("Zoom")}</span><select data-ws-zoom aria-label="${esc(tr("Zoom"))}"><option value="fit">${tr("Fit")}</option><option value=".5">50%</option><option value=".75">75%</option><option value="1">100%</option><option value="1.5">150%</option><option value="2">200%</option><option value="3">300%</option></select></label></div><div class="cw-stage" data-ws-stage><div class="cw-design-pane" data-ws-design-pane><div class="cw-stage-scroll" data-ws-scroll><div class="cw-artboard-shell"><div class="cw-artboard" data-ws-artboard tabindex="0" role="application" aria-label="${esc(tr("Move and resize artwork"))}" aria-describedby="cw-stage-help"><div class="cw-artboard-layers" data-ws-artboard-layers></div><div class="cw-safe-area" aria-hidden="true"></div><div class="cw-centre-line cw-centre-x" hidden></div><div class="cw-centre-line cw-centre-y" hidden></div><div class="cw-selection" data-ws-selection hidden><span class="cw-rotation-stem"></span><button type="button" class="cw-transform-handle cw-rotate-handle" data-ws-handle="rotate" aria-label="${esc(tr("Rotation"))}">${workspaceIcon("rotate")}</button>${["nw","n","ne","e","se","s","sw","w"].map(corner=>`<button type="button" class="cw-transform-handle cw-resize-handle cw-handle-${corner}" data-ws-handle="${corner}" aria-label="${esc(tr("Scale"))}"></button>`).join("")}</div></div><div class="cw-empty-canvas" data-ws-empty><span>${workspaceIcon("sparkle")}</span><strong>${tr("Add a photo. Make a statement.")}</strong><p>${tr("Start with an image, a few words, or both.")}</p><div><button type="button" class="cw-button cw-button-primary" data-ws-choose-files>${workspaceIcon("plus")}${tr("Add images")}</button><button type="button" class="cw-button" data-ws-add-text="body">${tr("Add text")}</button></div></div></div></div><p class="cw-stage-help" id="cw-stage-help">${tr("Drag to move · corners to resize · top handle to rotate")} · ${tr("Shift: straight line · Alt: ignore guides · Esc: cancel")}</p></div><div class="cw-preview-pane" data-ws-preview-pane hidden></div></div><footer class="cw-stage-footer"><span class="cw-stage-status" data-ws-status role="status" aria-live="polite">${workspaceIcon("check")}${tr("Ready to create")}</span><span>${workspaceIcon("lock")}${tr("Changes save automatically")}</span><button type="button" class="cw-fit-button" data-ws-fit title="${esc(tr("Fit to screen"))}">${workspaceIcon("canvas")}${tr("Fit")}</button></footer></div></div><p class="cw-provisional">${workspaceIcon("eye")}<strong>${tr("Provisional product preview")}</strong><span>${tr("Move artwork on the garment or edit it on the flat canvas.")}</span></p>`;
const libraryPanel=document.createElement("section");
  libraryPanel.className="cw-tool-panel cw-elements-panel";
  libraryPanel.id="cw-panel-elements";libraryPanel.dataset.wsPanel="elements";libraryPanel.hidden=true;
  libraryPanel.innerHTML=`<p class="cw-panel-intro">${tr("Editable graphics, emojis, flags and city badges. Emoji and flag symbols keep their original colours; decoration can be recoloured.")}</p><label class="cw-font-search">${workspaceIcon("search")}<input type="search" data-ws-element-search placeholder="${esc(tr("Search elements"))}" aria-label="${esc(tr("Search elements"))}"></label><label class="cw-element-category-label"><span>${tr("All categories")}</span><select data-ws-element-category aria-label="${esc(tr("All categories"))}"></select></label><p class="cw-element-count" data-ws-element-count></p><div class="cw-elements-grid" data-ws-element-list></div><button type="button" class="cw-button cw-element-more" data-ws-element-more hidden>${tr("More elements")}</button>`;
  shell.querySelector('[data-ws-panel="text"]').before(libraryPanel);
  const smartControls=document.createElement('div');
  smartControls.className='cw-smart-controls';
  smartControls.innerHTML='<div class="cw-saved-view" role="group" aria-label="Collections"><button type="button" data-ws-elements-view="all" aria-pressed="true">'+tr("Explore all")+'</button><button type="button" data-ws-elements-view="favourites" aria-pressed="false">'+tr("My favourites")+'</button><button type="button" data-ws-elements-view="recent" aria-pressed="false">'+tr("Recently used")+'</button></div><label class="cw-element-category-label"><span>'+tr("Curated collection")+'</span><select data-ws-element-collection aria-label="'+esc(tr("Curated collection"))+'"></select></label>';
  libraryPanel.querySelector('[data-ws-element-count]').before(smartControls);
  const templatesPanel=document.createElement('section');templatesPanel.className='cw-original-layouts';templatesPanel.dataset.wsOriginalLayouts='';
  shell.querySelector('[data-ws-layouts]').append(templatesPanel);
  let elementsView='all';

  root.append(shell);
  const uploadProgress=document.createElement('progress');
  uploadProgress.className='cw-upload-progress';uploadProgress.dataset.wsProgress='';uploadProgress.max=100;uploadProgress.value=0;uploadProgress.hidden=true;
  uploadProgress.setAttribute('aria-label',tr('Upload progress'));
  shell.querySelector('[data-ws-drop]').after(uploadProgress);
  const focusButton=document.createElement("button");
  focusButton.type="button";focusButton.className="cw-icon-button cw-focus-button";focusButton.dataset.wsFocus="";
  focusButton.setAttribute("aria-pressed","false");focusButton.setAttribute("aria-label",typeof currentLanguage==="function"&&currentLanguage()==="ar"?"وضع التركيز":"Focus mode");
  focusButton.title=focusButton.getAttribute("aria-label");focusButton.innerHTML=workspaceIcon("expand");
  shell.querySelector(".cw-history").append(focusButton);
  const copyControls=document.createElement("div");
  copyControls.className="cw-copy-controls";
  copyControls.innerHTML=`<button type="button" class="cw-copy-side" data-ws-copy-side hidden>${workspaceIcon("duplicate")}<span></span></button><div class="cw-copy-confirm" data-ws-copy-confirm hidden><p>${esc(typeof currentLanguage==="function"&&currentLanguage()==="ar"?"تبغى تستبدل تصميم هالجهة؟ تقدر تتراجع بعدها.":"Replace this side with the other design? You can undo this change.")}</p><button type="button" class="cw-button cw-button-primary" data-ws-confirm-copy>${esc(typeof currentLanguage==="function"&&currentLanguage()==="ar"?"انسخ التصميم":"Copy design")}</button><button type="button" class="cw-button" data-ws-cancel-copy>${esc(t("Cancel"))}</button></div>`;
  shell.querySelector(".cw-stage-toolbar").insertBefore(copyControls,shell.querySelector(".cw-zoom-control"));
  // Garment placement is a pure positioning aid, not a supplier template.
  // Keep the surface guide available in both flat and mockup modes.
  const placementControls=document.createElement("details");
  placementControls.className="cw-placement-assistant";
  placementControls.innerHTML='<summary>'+esc(tr("Placement assistant"))+'</summary><div class="cw-placement-assistant-body"><p>'+esc(tr("Choose a starting position, then fine-tune with the mouse. Safe bounds are provisional."))+'</p><div data-ws-placement-presets class="cw-placement-preset-list"></div><div class="cw-placement-utility"><button type="button" data-ws-fit-safe>'+esc(tr("Fit selected layer inside safe area"))+'</button><button type="button" data-ws-copy-layer>'+esc(tr("Copy selected layer to opposite side"))+'</button></div></div>';
  copyControls.after(placementControls);

  const originalVisual=root.querySelector(".studio-workspace > .studio-visual");
  if (originalVisual) shell.querySelector("[data-ws-preview-pane]").append(originalVisual);
  // The interactive preview covers the actual 1000x1000 projected garment
  // canvas. No duplicate artwork is drawn: manipulations change the same
  // private scene used for production and the ordinary flat editor.
  const previewCanvas=shell.querySelector("[data-ws-preview-pane] .studio-canvas"),
    previewFrame=previewCanvas?.closest(".design-mockup");
  const previewOverlay=document.createElement("div");
  previewOverlay.className="cw-preview-overlay";
  previewOverlay.dataset.wsPreviewOverlay="";
  previewOverlay.tabIndex=0;
  previewOverlay.setAttribute("role","application");
  previewOverlay.setAttribute("aria-label",tr("Move, resize and rotate design on product"));
  previewOverlay.innerHTML='<svg class="cw-preview-outline" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"><g class="cw-preview-guides"><path data-ws-preview-guide="x" d=""/><path data-ws-preview-guide="y" d=""/></g><polygon points="" /></svg>'+
    ["nw","ne","se","sw","rotate"].map(handle=>'<button type="button" data-ws-preview-handle="'+handle+'" aria-label="'+esc(tr(handle==="rotate"?"Rotate selected artwork":"Resize selected artwork"))+'" hidden></button>').join("");
  previewFrame?.append(previewOverlay);
  const starters=form.querySelector(".customer-starters");
  if (starters) { starters.open=true; shell.querySelector("[data-ws-layouts]").append(starters); }
  // The first-party editable starters must remain available even if legacy layouts are absent.
  const artboard=shell.querySelector("[data-ws-artboard]"), layersRoot=shell.querySelector("[data-ws-artboard-layers]"),
    selection=shell.querySelector("[data-ws-selection]"), scroll=shell.querySelector("[data-ws-scroll]"),
    inspector=shell.querySelector("[data-ws-inspector]"), imageCache=new Map(), glyphCache=new Map(), layerAssets=new Map(),libraryLoads=new Set();
  let elementLimit=48,elementBusy=false;
  let originalCollection="",originalQuery="",originalLimit=24;
  let selected=null,tool="uploads",mode="edit",zoom="fit",fitScale=.5,renderSerial=0,gesture=null,fontsReady=false,fontLimit=60,
    lastHistoryGroup=null,lastHistoryTime=0,restoring=false,activeKey="",fontObserver=null,disposed=false,focused=false;
  const history=[],future=[];
  let qualityTimer=null,qualitySerial=0;
  let previewRenderAt=0;
  const logical=()=>({width:900,height:900*instance.product().preview[1]/instance.product().preview[0]}),
    layers=()=>adapter.layers(), current=()=>layers().find(layer=>layer.id===selected),
    snapshot=()=>JSON.stringify({creative_personalisation:instance.state.creative_personalisation||null,scenes:instance.state.scenes,scene_version:instance.state.scene_version,active_product:instance.state.active_product,placements:instance.state.placements});
  const totalLayers=()=>Object.values(instance.state.scenes||{}).reduce((total,product)=>total+Object.values(product).reduce((sum,scene)=>sum+(scene.layers?.length||0),0),0);
  function canAdd(amount=1){
    if(layers().length+amount>24){setStatus("Add up to 24 layers on each side.",true);return false;}
    if(totalLayers()+amount>120){setStatus(typeof currentLanguage==="function"&&currentLanguage()==="ar"?"وصلت للحد الأقصى: 120 طبقة في التصميم.":"Add up to 120 layers across this design.",true);return false;}
    return true;
  }
  const setStatus=(message,error=false)=>{const node=shell.querySelector("[data-ws-status]");node.innerHTML=workspaceIcon(error?"eye":"check")+`<span>${esc(tr(message))}</span>`;node.dataset.error=String(error);};
  function record(group=null) {
    if (restoring) return;
    const value=snapshot(),now=Date.now();
    if (history.at(-1)===value) return;
    if (group && group===lastHistoryGroup && now-lastHistoryTime<850 && history.length>1) history[history.length-1]=value;
    else history.push(value);
    if (history.length>80) history.shift();
    future.length=0;lastHistoryGroup=group;lastHistoryTime=now;
    updateHistory();
  }
  function updateHistory(){shell.querySelector('[data-ws-action="undo"]').disabled=history.length<2;shell.querySelector('[data-ws-action="redo"]').disabled=!future.length;}
  function commit(group=null){record(group);adapter.commit({history:false});refresh();}
  function restore(direction){
    if(direction<0&&history.length<2||direction>0&&!future.length)return;
    if(direction<0){future.push(history.pop());}else history.push(future.pop());
    restoring=true;
    const previouslySelected=selected;
    Object.assign(instance.state,JSON.parse(history.at(-1)));
    // Undo and redo should not discard the selection when that layer survives.
    selected=layers().some(layer=>layer.id===previouslySelected)?previouslySelected:null;
    lastHistoryGroup=null;
    instance.syncControls?.();adapter.commit({history:false});refresh();restoring=false;updateHistory();
  }
  function selectLayer(layerId,{focus=false}={}){
    selected=layers().some(layer=>layer.id===layerId)?layerId:null;
    shell.dataset.selectedLayer=selected||"";
    renderSelection();renderLayerList();renderInspector();
    renderPlacementControls();renderPreviewSelection();
    if(focus)(mode==="preview"?previewOverlay:artboard).focus({preventScroll:true});
  }
  function switchTool(value){
    tool=value;shell.dataset.tool=tool;shell.dataset.panelOpen="true";
    shell.querySelector("[data-ws-panel-title]").textContent=tr(tools.find(item=>item[0]===tool)?.[2]||"Canvas");
    shell.querySelectorAll("[data-ws-tool]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.wsTool===tool)));
    shell.querySelectorAll("[data-ws-panel]").forEach(panel=>panel.hidden=panel.dataset.wsPanel!==tool);
    if(tool==="fonts")renderFonts();
    if(tool==="elements")renderElements();
    if(tool==="layouts")renderProLayouts();
    if(tool==="layers")renderLayerList();
  }
  function setMode(value){
    mode=value;shell.dataset.mode=mode;
    shell.querySelector("[data-ws-design-pane]").hidden=mode!=="edit";
    shell.querySelector("[data-ws-preview-pane]").hidden=mode!=="preview";
    shell.querySelectorAll("[data-ws-mode]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.wsMode===mode)));
    if(mode==="preview"){adapter.commit({history:false});instance.render?.();requestAnimationFrame(renderPreviewSelection);}else{renderPreviewGuides();resizeStage();}
  }
  function setFocus(value){
    focused=value;shell.classList.toggle("cw-focus-mode",focused);document.body.classList.toggle("has-studio-focus",focused);
    focusButton.setAttribute("aria-pressed",String(focused));
    focusButton.setAttribute("aria-label",typeof currentLanguage==="function"&&currentLanguage()==="ar"?(focused?"ارجع للصفحة":"وضع التركيز"):(focused?"Exit focus mode":"Focus mode"));
    focusButton.title=focusButton.getAttribute("aria-label");
    requestAnimationFrame(()=>{resizeStage();if(!focused)shell.scrollIntoView({block:"start",behavior:"instant"});});
  }
  function glyphKey(layer){return JSON.stringify([layer.text,layer.font,layer.color,layer.size,layer.align,layer.direction,layer.tracking??0]);}
  async function imageAsset(layer){
    const key=layer.type==="image"?"image:"+layer.upload_id:"text:"+glyphKey(layer),cache=layer.type==="image"?imageCache:glyphCache;
    if(!cache.has(key)){
      const promise=Promise.resolve(layer.type==="image"?adapter.image(layer.upload_id):adapter.glyph(layer));
      cache.set(key,promise);promise.catch(()=>{if(cache.get(key)===promise)cache.delete(key);});
      if(cache.size>180)cache.delete(cache.keys().next().value);
    }
    const image=await cache.get(key);
    return {image,key,size:layer.size};
  }
  function dimensions(layer){
    const dims=logical(),asset=layerAssets.get(layer.id);
    if(layer.type==="image")return {width:layer.width*dims.width,height:layer.height*dims.height};
    const scale=asset?.size?layer.size/asset.size:1;
    return {width:(asset?.image?.naturalWidth||Math.max(50,layer.text?.length*layer.size*500))*scale,height:(asset?.image?.naturalHeight||layer.size*1100)*scale};
  }
  function position(node,layer){
    const d=logical(),bounds=dimensions(layer);
    node.style.left=layer.x*100+"%";node.style.top=layer.y*100+"%";
    node.style.width=bounds.width/d.width*100+"%";node.style.height=bounds.height/d.height*100+"%";
    node.style.transform=`translate(-50%,-50%) rotate(${layer.rotation||0}deg)`;
  }
  // Project the flat scene's selected corners through the exact garment UV
  // mesh. The outline/handles are a UI overlay, not part of the print design.
  function renderPreviewGuides(guides=null){
    const geometry=window.VeeladPreviewGeometry,snap=window.VeeladPreviewSnap,
      projection=instance.asset?.projection;
    for(const axis of ['x','y']){
      const node=previewOverlay.querySelector('[data-ws-preview-guide="'+axis+'"]');
      if(!node)continue;
      const value=guides?.[axis];
      node.setAttribute('d',Number.isFinite(value)&&snap&&projection?
        snap.path(axis,value,projection,geometry):'');
    }
  }
  function renderPreviewSelection(){
    if(!previewCanvas||!previewFrame||!previewOverlay)return;
    const visible=mode==="preview"&&!!instance.asset?.projection;
    previewOverlay.hidden=!visible;
    if(!visible)return;
    const canvasRect=previewCanvas.getBoundingClientRect(),frameRect=previewFrame.getBoundingClientRect();
    if(!canvasRect.width||!canvasRect.height)return;
    previewOverlay.style.left=(canvasRect.left-frameRect.left)+"px";
    previewOverlay.style.top=(canvasRect.top-frameRect.top)+"px";
    previewOverlay.style.width=canvasRect.width+"px";
    previewOverlay.style.height=canvasRect.height+"px";
    const layer=current(),geom=window.VeeladPreviewGeometry,d=logical();
    const polygon=previewOverlay.querySelector("polygon");
    const handles=[...previewOverlay.querySelectorAll("[data-ws-preview-handle]")];
    if(!layer||layer.visible===false||!geom){polygon.setAttribute("points","");handles.forEach(button=>button.hidden=true);return;}
    const bounds=dimensions(layer);
    const quad=geom.corners(layer,bounds.width/d.width,bounds.height/d.height,instance.asset.projection,d.height/d.width);
    if(quad.length!==4){polygon.setAttribute("points","");handles.forEach(button=>button.hidden=true);return;}
    polygon.setAttribute("points",quad.map(p=>[p.x*1000,p.y*1000].join(",")).join(" "));
    handles.forEach((button,index)=>{
      if(layer.locked){button.hidden=true;return;}
      let p=quad[index];
      if(index===4){
        const middle={x:(quad[0].x+quad[1].x)/2,y:(quad[0].y+quad[1].y)/2},
          center={x:quad.reduce((sum,v)=>sum+v.x,0)/4,y:quad.reduce((sum,v)=>sum+v.y,0)/4};
        const vector={x:(middle.x-center.x)*canvasRect.width,y:(middle.y-center.y)*canvasRect.height};
        const length=Math.hypot(vector.x,vector.y)||1;
        p={x:middle.x+vector.x/length*28/canvasRect.width,y:middle.y+vector.y/length*28/canvasRect.height};
      }
      button.style.left=p.x*100+"%";
      button.style.top=p.y*100+"%";
      button.hidden=false;
    });
  }
  function previewPoint(event){
    if(!previewCanvas||!instance.asset?.projection||!window.VeeladPreviewGeometry)return null;
    const rect=previewCanvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return null;
    const uv=window.VeeladPreviewGeometry.toUV((event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height,instance.asset.projection);
    if(!uv)return null;
    const d=logical();
    return {x:uv.x*d.width,y:uv.y*d.height,uv};
  }
  function schedulePreviewRender(){
    const now=Date.now();
    if(now-previewRenderAt<110)return;
    previewRenderAt=now;
    void instance.render?.();
  }
  function beginPreviewGesture(event){
    if(event.button!==0||mode!=="preview"||!instance.asset?.projection)return;
    const geom=window.VeeladPreviewGeometry,point=previewPoint(event);
    if(!point||!geom)return;
    const handle=event.target.closest("[data-ws-preview-handle]");
    if(!handle){
      const d=logical();
      const matching=[...layers()].reverse().find(layer=>{
        if(layer.visible===false||(layer.opacity??1)<=0)return false;
        const size=dimensions(layer);
        return geom.hit(layer,point.uv,size.width/d.width,size.height/d.height,d.height/d.width);
      });
      selectLayer(matching?.id||null);
    }
    const layer=current();
    if(!layer||layer.locked||layer.visible===false)return;
    const kind=handle?.dataset.wsPreviewHandle||"move",d=logical(),bounds=dimensions(layer),original=cloneState(layer);
    gesture={preview:true,id:layer.id,kind,point:{x:point.x,y:point.y},original,bounds,before:snapshot(),pointer:event.pointerId};
    if(kind!=="move"&&kind!=="rotate"){
      const sx=kind.includes("e")?1:kind.includes("w")?-1:0,sy=kind.includes("s")?1:kind.includes("n")?-1:0,angle=layer.rotation*Math.PI/180,
        opposite=rotatePoint({x:-sx*bounds.width/2,y:-sy*bounds.height/2},angle);
      gesture.anchor={x:layer.x*d.width+opposite.x,y:layer.y*d.height+opposite.y};
      gesture.sx=sx;gesture.sy=sy;
    }
    previewOverlay.setPointerCapture(event.pointerId);
    previewOverlay.focus({preventScroll:true});
    event.preventDefault();
  }
  function movePreviewGesture(event){
    if(!gesture?.preview||gesture.pointer!==event.pointerId)return;
    moveGesture(event);
  }
  function paint(){
    const ids=new Set(layers().map(layer=>layer.id));
    for(const node of layersRoot.children)if(!ids.has(node.dataset.wsLayer))node.remove();
    for(const layer of layers()){
      let node=[...layersRoot.children].find(n=>n.dataset.wsLayer===layer.id);
      if(!node){node=document.createElement("div");node.className="cw-layer";node.dataset.wsLayer=layer.id;node.innerHTML='<img draggable="false" alt="">';layersRoot.append(node);}
      node.hidden=layer.visible===false;node.dataset.locked=String(!!layer.locked);node.dataset.selected=String(layer.id===selected);
      node.style.opacity=layer.opacity??1;position(node,layer);
      const asset=layerAssets.get(layer.id);
      if(asset?.image){
        node.dataset.loaded="true";
        const repeating=layer.type==="image"&&layer.repeat===true;
        node.dataset.repeat=String(repeating);
        if(repeating){
          const d=logical(),bounds=dimensions(layer),angle=layer.rotation*Math.PI/180;
          const centers=instance.math.patternCenters({x:layer.x*d.width,y:layer.y*d.height,width:bounds.width,height:bounds.height,bounds:{width:Math.abs(Math.cos(angle))*bounds.width+Math.abs(Math.sin(angle))*bounds.height,height:Math.abs(Math.sin(angle))*bounds.width+Math.abs(Math.cos(angle))*bounds.height}},d.width,d.height,true)||[];
          node.style.left="0";node.style.top="0";node.style.width="100%";node.style.height="100%";node.style.transform="none";
          while(node.children.length>centers.length)node.lastElementChild.remove();
          centers.forEach((center,index)=>{let image=node.children[index];if(!image){image=document.createElement("img");image.draggable=false;image.alt="";node.append(image);}if(image.src!==asset.image.src)image.src=asset.image.src;image.style.cssText=`position:absolute;left:${center.x/d.width*100}%;top:${center.y/d.height*100}%;width:${bounds.width/d.width*100}%;height:${bounds.height/d.height*100}%;transform:translate(-50%,-50%) rotate(${layer.rotation}deg)`;});
        }else{
          if(node.children.length!==1)node.innerHTML='<img draggable="false" alt="">';
          const image=node.firstElementChild;image.style.cssText="";if(image.src!==asset.image.src)image.src=asset.image.src;
        }
      }else node.dataset.loaded="false";
      layersRoot.append(node);
    }
    const visible=layers().some(layer=>layer.visible!==false&&(layer.type==="image"||layer.text?.trim()));
    shell.querySelector("[data-ws-empty]").hidden=visible;
    const background=adapter.scene().background||"transparent";
    artboard.style.backgroundColor=background==="transparent"?"transparent":background;
    shell.querySelector("[data-ws-transparent]").checked=background==="transparent";
    if(background!=="transparent")shell.querySelector("[data-ws-background]").value=background;
    renderSelection();
  }
  async function render(){
    const serial=++renderSerial;
    paint();
    const list=layers().filter(layer=>layer.visible!==false&&(layer.type==="image"||layer.text?.trim()));
    let failed=false;
    await Promise.all(list.map(async layer=>{
      try{const asset=await imageAsset(cloneState(layer));if(serial!==renderSerial||!root.isConnected)return;layerAssets.set(layer.id,asset);}
      catch{failed=true;}
    }));
    if(serial!==renderSerial||!root.isConnected)return;
    paint();renderLayerList();renderUploads();renderQuality();
    if(failed)setStatus("Could not load this layer.",true);
    else setStatus(layers().length?"Changes save automatically":"Ready to create");
  }
  function renderQuality(){
    if(typeof adapter.quality!=="function")return;
    clearTimeout(qualityTimer);const serial=++qualitySerial;
    qualityTimer=setTimeout(async()=>{
      try{
        const sourceWarnings=await adapter.quality();if(serial!==qualitySerial||!root.isConnected)return;
        const placement=window.VeeladStudioPro?.preflight(layers(),adapter.surface())||[];
        const warnings=[...(sourceWarnings||[]),...placement];
        let node=shell.querySelector("[data-ws-quality]");
        if(!node){node=document.createElement("ul");node.className="cw-quality-warnings";node.dataset.wsQuality="";node.setAttribute("aria-live","polite");shell.querySelector(".cw-provisional").before(node);}
        node.hidden=!warnings?.length;node.replaceChildren(...(warnings||[]).map(warning=>{const li=document.createElement("li");li.textContent=tr(warning);return li;}));
      }catch{}
    },300);
  }
  function renderSelection(){
    const layer=current();selection.hidden=!layer||layer.visible===false;
    if(!layer)return;
    position(selection,layer);selection.dataset.locked=String(!!layer.locked);
    selection.querySelectorAll("button").forEach(button=>button.hidden=!!layer.locked||(layer.type==="text"&&button.dataset.wsHandle?.length===1));
  }
  function renderPlacementControls(){
    const helper=window.VeeladPlacementAssistant;
    if(!helper)return;
    const type=instance.product().id,side=adapter.surface(),language=currentLanguage();
    const key=type+':'+side+':'+language;
    const list=placementControls.querySelector('[data-ws-placement-presets]');
    if(list.dataset.key!==key){
      list.innerHTML=helper.list(type,side).map(p=>'<button type="button" data-ws-placement-preset="'+esc(p.id)+'">'+esc(helper.title(p,language))+'</button>').join('');
      list.dataset.key=key;
    }
    const layer=current(),canMove=!!layer&&!layer.locked;
    list.querySelectorAll('button').forEach(button=>button.disabled=!canMove);
    placementControls.querySelector('[data-ws-fit-safe]').disabled=!canMove;
    const opposite=side==='front'?'back':'front',
      dest=instance.state.scenes?.[type]?.[opposite],copy=placementControls.querySelector('[data-ws-copy-layer]');
    copy.hidden=type!=='shirt';
    copy.disabled=!layer||!!dest&&dest.layers.length>=24||totalLayers()>=120;
    placementControls.dataset.surface=side;
  }
  function placeSelectedArtwork(key){
    const layer=current(),helper=window.VeeladPlacementAssistant;
    if(!layer||layer.locked||!helper)return;
    const d=logical(),size=dimensions(layer),
      updated=helper.apply(layer,key,{width:size.width/d.width,height:size.height/d.height},
        d.height/d.width,instance.product().id,adapter.surface());
    if(!updated){setStatus("This layer cannot fit that print region. Reduce the size first.",true);return;}
    Object.assign(layer,updated);
    commit();
    setStatus("Artwork positioned within the provisional safe area.");
  }
  function copySelectedLayerToOppositeSide(){
    const layer=current(),type=instance.product().id,side=adapter.surface();
    if(type!=='shirt'||!layer)return;
    const targetSide=side==='back'?'front':'back';
    instance.state.scenes ||= {};
    instance.state.scenes.shirt ||= {};
    const target=instance.state.scenes.shirt[targetSide]||={background:'transparent',layers:[]};
    if(target.layers.length>=24||totalLayers()>=120){
      setStatus("The opposite side has reached the layer limit.",true);return;
    }
    target.layers.push({...cloneState(layer),id:uid()});
    commit();
    setStatus("Selected layer copied. Switch sides to position it independently.");
  }
  function renderSurfaces(){
    const surfaces=adapter.surfaces(),active=adapter.surface(),key=surfaces.map(s=>s.id+":"+s.label).join("|");
    const node=shell.querySelector("[data-ws-surfaces]");
    if(node.dataset.key!==key){node.innerHTML=surfaces.map(side=>`<button type="button" data-ws-surface="${esc(side.id)}"><span>${tr(side.label||({front:"Front",back:"Back",wrap:"Wrap"}[side.id])||side.id)}</span><i aria-hidden="true"></i></button>`).join("");node.dataset.key=key;}
    node.querySelectorAll("button").forEach(button=>{button.setAttribute("aria-pressed",String(button.dataset.wsSurface===active));const scene=instance.state.scenes?.[instance.product().id]?.[button.dataset.wsSurface];button.dataset.hasDesign=String(!!scene?.layers?.length);});
    shell.dataset.surface=active;
    shell.querySelector("[data-ws-surface-note]").textContent=surfaces.length>1?tr("Independent designs on each side"):active==="wrap"?tr("One continuous wrap"):"";
    const other=surfaces.find(side=>side.id!==active),source=other&&instance.state.scenes?.[instance.product().id]?.[other.id],copy=copyControls.querySelector("[data-ws-copy-side]");
    copy.hidden=!source?.layers?.length;
    copy.dataset.source=other?.id||"";
    copy.querySelector("span").textContent=typeof currentLanguage==="function"&&currentLanguage()==="ar"?(other?.id==="front"?"انسخ تصميم الأمام":"انسخ تصميم الخلف"):(other?.id==="front"?"Copy front design":"Copy back design");
    copyControls.querySelector("[data-ws-copy-confirm]").hidden=true;
    renderPlacementControls();
  }
function renderElements(){
    const api=window.VeeladElements,pro=window.VeeladStudioPro,list=shell.querySelector("[data-ws-element-list]");
    if(!api){list.textContent="Element library unavailable.";return;}
    const categorySelect=shell.querySelector("[data-ws-element-category]"),collectionSelect=shell.querySelector("[data-ws-element-collection]");
    if(!categorySelect.options.length)categorySelect.innerHTML='<option value="">'+esc(tr("All categories"))+'</option>'+api.categories.map(name=>'<option value="'+esc(name)+'">'+esc(api.categoryLabel(name,currentLanguage()))+'</option>').join("");
    if(pro&&!collectionSelect.options.length)collectionSelect.innerHTML='<option value="">'+esc(tr("Explore all"))+'</option>'+pro.folders.map(folder=>'<option value="'+esc(folder.id)+'">'+esc(pro.title(folder,currentLanguage()))+'</option>').join("");
    const search=shell.querySelector("[data-ws-element-search]").value.trim(),category=categorySelect.value;
    const matched=pro?pro.search(api,search,category,collectionSelect.value,elementsView):api.search(search,category);
    const visible=matched.slice(0,elementLimit),favorites=new Set(pro?.read().favourites||[]);
    shell.querySelector("[data-ws-element-count]").textContent=visible.length.toLocaleString()+" / "+matched.length.toLocaleString()+(search?"":" · "+api.catalog.length.toLocaleString()+" total");
    shell.querySelectorAll('[data-ws-elements-view]').forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.wsElementsView===elementsView)));
    list.innerHTML=visible.map(item=>`<div class="cw-element-entry"><button type="button" class="cw-element-tile" draggable="true" data-ws-element="${esc(item.id)}" title="${esc(api.label(item.id,currentLanguage()))}" aria-label="${esc("Add element "+api.label(item.id,currentLanguage()))}"><span class="cw-element-visual">${api.svg(item.id)}</span><small>${esc(api.label(item.id,currentLanguage()))}</small></button><button type="button" class="cw-favourite-button" data-ws-favourite="${esc(item.id)}" aria-label="${favorites.has(item.id)?'Remove from favourites':'Add to favourites'}" aria-pressed="${favorites.has(item.id)}">♡</button></div>`).join("")||'<p class="cw-muted">No matching elements. Try a different keyword or collection.</p>';
    shell.querySelector("[data-ws-element-more]").hidden=matched.length<=visible.length;
  }
  function renderOriginalDropCards(){
    const api=window.VeeladOriginalDrops,host=shell.querySelector('[data-ws-original-drop-list]');
    if(!api||!host)return;
    const matched=api.search(originalQuery,originalCollection),visible=matched.slice(0,originalLimit);
    host.innerHTML=visible.map(item=>'<button type="button" class="cw-original-drop" data-ws-original-apply="'+esc(item.id)+'" aria-label="'+esc(tr("Use this design")+' · '+api.label(item.id,currentLanguage()))+'"><span class="cw-original-drop-art">'+api.svg(item.id)+'</span><span class="cw-original-drop-title">'+esc(api.label(item.id,currentLanguage()))+'</span><span class="cw-original-drop-subtitle">'+esc(item.slogan)+'</span></button>').join('')||'<p class="cw-muted">'+esc(tr("No designs match your search."))+'</p>';
    shell.querySelector('[data-ws-original-drop-count]').textContent=visible.length+' / '+matched.length;
    shell.querySelector('[data-ws-original-drop-more]').hidden=visible.length>=matched.length;
  }
  async function applyOriginalDrop(id){
    const api=window.VeeladOriginalDrops,item=api?.find(id);
    if(!item||elementBusy||!canAdd(2)||totalLayers()>118)return;
    const product=instance.product().id,surface=adapter.surface();
    const artwork=await addElement(id);
    if(!artwork||!root.isConnected||instance.product().id!==product||adapter.surface()!==surface)return;
    const scale=Math.min(.64/artwork.width,.46/artwork.height,2);
    artwork.width*=scale;artwork.height*=scale;
    artwork.x=.5;artwork.y=.39;
    const layer={id:uid(),type:'text',text:item.slogan,font:'manrope',
      color:item.colors.primary,size:.047,x:.5,y:.77,rotation:0,opacity:1,
      visible:true,locked:false,align:'center',direction:'auto'};
    layers().push(layer);selected=layer.id;
    commit();
    setStatus("Original design added. Customise the artwork and headline.");
  }
  function renderProLayouts(){
    const pro=window.VeeladStudioPro,api=window.VeeladElements,target=shell.querySelector('[data-ws-original-layouts]');
    if(!pro||!target)return;
    target.innerHTML='<h5>'+esc(tr("Ready-made designs"))+'</h5><p class="cw-muted">'+esc(tr("Original editable starting points"))+'</p><div class="cw-original-layout-grid">'+pro.templates.map(template=>`<button type="button" class="cw-original-layout" data-ws-pro-layout="${esc(template.id)}"><span class="cw-original-layout-art">${api.svg(template.element)}</span><strong>${esc(pro.title(template,currentLanguage()))}</strong><small>${esc(template.tag)}</small></button>`).join('')+'</div>';
    const drops=window.VeeladOriginalDrops;
    if(drops){
      const options=drops.collections.map(row=>'<option value="'+esc(row.id)+'" '+(originalCollection===row.id?'selected':'')+'>'+esc(currentLanguage()==='ar'?row.ar:currentLanguage()==='zh-CN'?row.zh:row.title)+'</option>').join('');
      target.insertAdjacentHTML('beforeend','<section class="cw-original-drops"><div class="cw-original-drops-head"><p class="cw-original-drops-kicker">VEELAD ORIGINALS · EDITION 02</p><h5>'+esc(tr("Original design collections"))+'</h5><p>'+esc(tr("48 original illustrations across eight collections. Every design can be customised."))+'</p></div><div class="cw-original-drop-tools"><label><span>'+esc(tr("Collection"))+'</span><select data-ws-original-collection><option value="">'+esc(tr("All collections"))+'</option>'+options+'</select></label><label><span>'+esc(tr("Search designs"))+'</span><input data-ws-original-query type="search" value="'+esc(originalQuery)+'" placeholder="'+esc(tr("Search by name or theme"))+'"></label></div><p class="cw-original-drop-counter" data-ws-original-drop-count></p><div class="cw-original-drop-grid" data-ws-original-drop-list></div><button type="button" data-ws-original-drop-more class="cw-original-drop-more">'+esc(tr("Load more designs"))+'</button><p class="cw-original-drop-note">'+esc(tr("Concept artwork only. Supplier print settings and physical samples are not yet verified."))+'</p></section>');
      renderOriginalDropCards();
    }
  }
  async function applyProLayout(templateId){
    const pro=window.VeeladStudioPro,template=pro?.templates.find(item=>item.id===templateId);
    if(!template||elementBusy||!canAdd()||totalLayers()>118)return;
    const item=await addElement(template.element);
    if(!item||!root.isConnected||!canAdd())return;
    item.x=template.x;item.y=template.y;
    item.width=Math.min(item.width,.35);item.height=Math.min(item.height,.35);
    const layer={id:uid(),type:'text',text:template.label,font:'manrope',color:template.color,size:.055,x:.5,y:.73,rotation:0,opacity:1,visible:true,locked:false,align:'center',direction:'auto'};
    layers().push(layer);selected=layer.id;commit();
    setStatus("Template applied");
  }
  async function addElement(elementId,point=null){
    const api=window.VeeladElements,entry=api?.find(elementId);
    if(!entry||elementBusy||!canAdd())return;
    elementBusy=true;setStatus("Preparing element…");
    try{
      const product=instance.product().id,surface=adapter.surface(),colors=api.defaults(elementId);
      const file=await api.file(elementId,colors);
      const added=await adapter.addImages([file]);
      if(!root.isConnected)return;
      const layer=added?.at(-1);
      if(!layer)return;
      layer.library_element={id:elementId,colors};
      if(instance.product().id===product&&adapter.surface()===surface&&point){
        layer.x=clamp(point.x,0,1);layer.y=clamp(point.y,0,1);
      }
      const scale=Math.min(.43/layer.width,.43/layer.height,1);
      layer.width*=scale;layer.height*=scale;
      selected=layer.id;window.VeeladStudioPro?.used(elementId);commit();return layer;
    }catch(error){setStatus(error.message||"Could not load this layer.",true);return null;}
    finally{elementBusy=false;}
  }
  async function recolourElement(layerId,channel,color){
    const layer=layers().find(item=>item.id===layerId);
    if(!layer?.library_element||!["primary","secondary","accent"].includes(channel))return;
    if(!/^#[a-f0-9]{6}$/i.test(color))return;
    return recolourPalette(layerId,{...layer.library_element.colors,[channel]:color.toLowerCase()});
  }
  async function recolourPalette(layerId,nextColors){
    const api=window.VeeladElements,layer=layers().find(item=>item.id===layerId);
    if(!layer?.library_element||layer.locked||elementBusy)return;
    const originalId=layer.library_element.id,originalColors=layer.library_element.colors;
    if(!nextColors||!["primary","secondary","accent"].every(key=>/^#[a-f0-9]{6}$/i.test(nextColors[key]||"")))return;
    const next=Object.fromEntries(["primary","secondary","accent"].map(key=>[key,nextColors[key].toLowerCase()]));
    if(["primary","secondary","accent"].every(key=>next[key]===originalColors[key]))return;
    elementBusy=true;setStatus("Preparing element…");
    const product=instance.product().id,surface=adapter.surface();
    try{
      const file=await api.file(originalId,next),generated=await adapter.addImages([file]),replacement=generated?.at(-1);
      if(!replacement)return;
      const scene=instance.state.scenes?.[product]?.[surface],list=scene?.layers||[],target=list.find(l=>l.id===layerId);
      if(target?.library_element?.id===originalId){
        target.upload_id=replacement.upload_id;
        target.library_element={id:originalId,colors:next};
        layerAssets.delete(layerId);
      }
      const index=list.findIndex(l=>l.id===replacement.id);
      if(index>=0)list.splice(index,1);
      if(root.isConnected){selected=layerId;commit();setStatus("Element updated");}
    }catch(error){setStatus(error.message||"Could not load this layer.",true);}
    finally{elementBusy=false;}
  }
  function renderLayerList(){
    const node=shell.querySelector("[data-ws-layer-list]"),list=layers();
    node.innerHTML=list.length?[...list].reverse().map((layer,index)=>{
      const asset=layerAssets.get(layer.id),label=layer.type==="text"?(layer.text||tr("Text layer")):layer.library_element?(window.VeeladElements?.label(layer.library_element.id,currentLanguage())||tr("Element")):tr("Image")+" "+(list.length-index);
      return `<article class="cw-layer-row" draggable="${!layer.locked}" data-ws-sort-layer="${esc(layer.id)}" data-selected="${layer.id===selected}" title="${esc(tr("Drag to reorder. Alt+Shift+Arrow keys also work."))}"><button type="button" class="cw-layer-pick" data-ws-select="${esc(layer.id)}" aria-pressed="${layer.id===selected}"><span class="cw-layer-thumb">${asset?.image?`<img src="${esc(asset.image.src)}" alt="">`:workspaceIcon(layer.type==="text"?"text":"image")}</span><span dir="auto">${esc(label.slice(0,45))}</span></button><button type="button" class="cw-layer-toggle" data-ws-toggle-visible="${esc(layer.id)}" aria-label="${esc(tr(layer.visible===false?"Show layer":"Hide layer"))}" title="${esc(tr(layer.visible===false?"Show layer":"Hide layer"))}">${workspaceIcon(layer.visible===false?"hidden":"eye")}</button><button type="button" class="cw-layer-toggle" data-ws-toggle-lock="${esc(layer.id)}" aria-label="${esc(tr(layer.locked?"Unlock layer":"Lock layer"))}" title="${esc(tr(layer.locked?"Unlock layer":"Lock layer"))}">${workspaceIcon(layer.locked?"lock":"unlock")}</button></article>`;
    }).join(""):`<div class="cw-empty-panel">${workspaceIcon("layers")}<strong>${tr("No layers yet")}</strong><p>${tr("Add images or text. Every element stays editable.")}</p></div>`;
  }
  function reorderLayers(sourceId,targetId,placeAfter=false){
    const source=layers().find(item=>item.id===sourceId),target=layers().find(item=>item.id===targetId);
    if(!source||!target||source.locked||target.locked||sourceId===targetId)return false;
    const ordered=window.VeeladLayerOrder?.reorderTopFirst([...layers()].reverse(),sourceId,targetId,placeAfter);
    if(!ordered||ordered.every((layer,i)=>layer.id===[...layers()].reverse()[i]?.id))return false;
    const list=layers();list.splice(0,list.length,...ordered.reverse());
    selected=sourceId;commit();setStatus("Layer order updated");
    return true;
  }
  function renderUploads(){
    const all=new Map();
    for(const product of Object.values(instance.state.scenes||{}))for(const scene of Object.values(product))for(const layer of scene.layers||[])if(layer.type==="image"&&!layer.library_element)all.set(layer.upload_id,layer);
    for(const [upload,layer] of all)if(!layerAssets.has(layer.id)&&!libraryLoads.has(upload)){
      libraryLoads.add(upload);
      imageAsset(layer).then(asset=>{if(!root.isConnected)return;layerAssets.set(layer.id,asset);const node=shell.querySelector("[data-ws-upload-library]");delete node.dataset.key;renderUploads();}).catch(()=>{});
    }
    const node=shell.querySelector("[data-ws-upload-library]"),key=[...all.keys()].join("|")+":"+[...all.values()].map(l=>layerAssets.has(l.id)).join("");
    if(node.dataset.key===key)return;node.dataset.key=key;
    node.innerHTML=[...all].map(([upload,layer])=>{const asset=layerAssets.get(layer.id);return `<button type="button" draggable="true" data-ws-reuse="${esc(upload)}" title="${esc(tr("Add images"))}">${asset?.image?`<img src="${esc(asset.image.src)}" alt="${esc(tr("Your image"))}">`:workspaceIcon("image")}<span>${workspaceIcon("plus")}</span></button>`;}).join("");
  }
  async function reuseImage(upload,point=null){
    if(!canAdd())return;
    const source=Object.values(instance.state.scenes||{}).flatMap(product=>
      Object.values(product).flatMap(scene=>scene.layers||[])).find(item=>item.type==='image'&&item.upload_id===upload);
    if(!source)return;
    try{
      const product=instance.product().id,surface=adapter.surface(),image=await adapter.image(upload);
      if(!root.isConnected||instance.product().id!==product||adapter.surface()!==surface||!canAdd())return;
      const d=logical(),fit=Math.min(d.width*.74/image.naturalWidth,d.height*.74/image.naturalHeight);
      const layer={id:uid(),type:'image',upload_id:upload,x:clamp(point?.x??.5,0,1),y:clamp(point?.y??.5,0,1),
        width:image.naturalWidth*fit/d.width,height:image.naturalHeight*fit/d.height,
        rotation:0,repeat:false,opacity:1,visible:true,locked:false};
      layers().push(layer);selected=layer.id;commit();
    }catch{setStatus('Could not load this layer.',true);}
  }
  function prop(label,key,value,{type="number",min=0,max=100,step=1,extra=""}={}){
    return `<label class="cw-property"><span>${tr(label)}</span><input type="${type}" data-ws-prop="${key}" value="${esc(String(value))}" min="${min}" max="${max}" step="${step}" ${type==="number"?'dir="ltr"':""} ${extra}></label>`;
  }
  function renderInspector(){
    const layer=current(),focus=document.activeElement;
    if(inspector.contains(focus)&&focus.matches("input,textarea,select"))return;
    if(!layer){inspector.hidden=true;inspector.innerHTML="";return;}
    inspector.hidden=false;
    inspector.innerHTML=`<div class="cw-inspector-heading"><h4>${tr("Selected layer")}</h4><span>${tr(layer.type==="text"?"Text":"Image")}</span></div>${layer.locked?`<p class="cw-lock-notice">${workspaceIcon("lock")}${tr("Layer is locked. Unlock it to edit.")}</p>`:""}<fieldset ${layer.locked?"disabled":""}><div class="cw-selection-actions">${action("duplicate","Duplicate","duplicate")}${action("delete","Delete","delete")}${action("forward","Move forward","up")}${action("backward","Move backward","down")}</div>${layer.library_element?`<div class="cw-element-inspector"><h5>${tr("Element colours")}</h5><div class="cw-element-inspector-preview" data-ws-element-preview>${window.VeeladElements?.svg(layer.library_element.id,layer.library_element.colors)||""}</div>${["emoji","flag"].includes(window.VeeladElements?.find(layer.library_element.id)?.kind)?`<p class="cw-element-immutable-note">${tr(window.VeeladElements.find(layer.library_element.id).variant===0?"Original national flag and emoji colours cannot be changed.":"Emoji and flag symbols retain their colours. Change the badge colours instead.")}</p>`:""}${(["emoji","flag"].includes(window.VeeladElements?.find(layer.library_element.id)?.kind)?({0:[],1:["secondary"],2:["secondary"],3:["secondary","accent"],4:["secondary"],5:["accent"],6:["secondary"],7:["secondary","accent"]}[window.VeeladElements.find(layer.library_element.id).variant]||[]):["primary","secondary","accent"]).map(key=>`<label class="cw-element-colour"><span>${tr(key==="primary"?"Primary":key==="secondary"?"Secondary":"Accent")}</span><input type="color" data-ws-element-colour="${key}" value="${esc(layer.library_element.colors[key])}" aria-label="${esc(tr(key==="primary"?"Primary":key==="secondary"?"Secondary":"Accent"))}"></label>`).join("")}</div>`:""}${layer.type==="text"?`<label class="cw-property"><span>${tr("Your text")}</span><textarea data-ws-prop="text" maxlength="500" rows="3" dir="auto">${esc(layer.text||"")}</textarea><small><span data-ws-character-count>${layer.text?.length||0}</span>/500</small></label><button type="button" class="cw-selected-font" data-ws-open-fonts><span>${tr("Font")}</span><strong>${esc(window.VeeladFonts?.get(layer.font)?.label||layer.font)}</strong>${workspaceIcon("fonts")}</button><p class="cw-glyph-warning" data-ws-glyph-warning hidden></p><div class="cw-property-grid">${prop("Colour","color",layer.color,{type:"color"})}${prop("Text size (%)","size",Math.round(layer.size*1000)/10,{min:.5,max:50,step:.1})}${prop("Letter spacing (%)","tracking",Math.round((layer.tracking??0)*1000)/10,{min:-8,max:30,step:.5})}</div><label class="cw-property"><span>${tr("Alignment")}</span><select data-ws-prop="align">${["left","center","right"].map(align=>`<option value="${align}" ${layer.align===align?"selected":""}>${tr(align==="center"?"Centre":align==="left"?"Left":"Right")}</option>`).join("")}</select></label><label class="cw-property"><span>${tr("Writing direction")}</span><select data-ws-prop="direction">${[["auto","Automatic"],["rtl","Right to left"],["ltr","Left to right"]].map(([key,label])=>`<option value="${key}" ${layer.direction===key?"selected":""}>${tr(label)}</option>`).join("")}</select></label>`:`<div class="cw-property-grid">${prop("Width (%)","width",Math.round(layer.width*1000)/10,{min:1,max:300,step:.1})}${prop("Height (%)","height",Math.round(layer.height*1000)/10,{min:1,max:300,step:.1})}</div><label class="cw-check"><input type="checkbox" data-ws-proportions checked>${tr("Keep proportions")}</label>`}<div class="cw-property-grid">${prop("Horizontal (%)","x",Math.round(layer.x*1000)/10,{step:.1})}${prop("Vertical (%)","y",Math.round(layer.y*1000)/10,{step:.1})}${prop("Rotation","rotation",Math.round(layer.rotation||0),{min:-180,max:180})}${prop("Opacity","opacity",Math.round((layer.opacity??1)*100))}</div><div class="cw-centre-actions"><button type="button" data-ws-action="centre-x">${workspaceIcon("centre")}${tr("Centre horizontally")}</button><button type="button" data-ws-action="centre-y">${workspaceIcon("centre")}${tr("Centre vertically")}</button><button type="button" data-ws-action="safe-left">${workspaceIcon("centre")}${tr("Align to safe left")}</button><button type="button" data-ws-action="safe-right">${workspaceIcon("centre")}${tr("Align to safe right")}</button><button type="button" data-ws-action="safe-top">${workspaceIcon("centre")}${tr("Align to safe top")}</button><button type="button" data-ws-action="safe-bottom">${workspaceIcon("centre")}${tr("Align to safe bottom")}</button></div><p class="cw-studio-print-note">${tr("Place artwork within the provisional safe region. Final supplier dimensions are not yet approved.")}</p></fieldset>`;
    const paletteParent=inspector.querySelector(".cw-element-inspector");
    if(paletteParent&&layer.library_element&&!layer.locked&&window.VeeladStudioPro&&!["emoji","flag"].includes(window.VeeladElements.find(layer.library_element.id)?.kind)){
      const paletteBox=document.createElement("div");paletteBox.className="cw-palette-presets";
      const palettes=[...(window.VeeladStudioPro.palettes||[]),...(window.VeeladColourTools?.read()||[])];
      for(const palette of palettes){
        const colors=palette.colors||Object.values(window.VeeladElements.defaults(layer.library_element.id));
        const button=document.createElement("button");button.type="button";button.dataset.wsPalette=palette.id;
        button.title=button.ariaLabel=palette.title;
        const chips=document.createElement("span");chips.className="cw-palette-chips";
        for(const color of colors){const chip=document.createElement("i");chip.style.background=color;chips.append(chip);}
        const label=document.createElement("small");label.textContent=window.VeeladStudioPro.title(palette,currentLanguage())||palette.title;
        button.append(chips,label);paletteBox.append(button);
      }
      const actions=document.createElement("div");actions.className="cw-palette-actions";
      const saved=document.createElement("button");saved.type="button";saved.dataset.wsSavePalette="";saved.textContent=tr("Save these colours");actions.append(saved);
      if(layers().some(item=>item.type==="image"&&!item.library_element)){
        const extraction=document.createElement("button");extraction.type="button";extraction.dataset.wsExtractPalette="";extraction.textContent=tr("Colours from photo");actions.append(extraction);
      }
      paletteBox.append(actions);paletteParent.append(paletteBox);
    }
    checkGlyphs();
  }
  function checkGlyphs(){
    const layer=current(),node=inspector.querySelector("[data-ws-glyph-warning]");
    if(!node||layer?.type!=="text"||!fontsReady)return;
    const missing=window.VeeladFonts.missingGlyphs(layer.font,layer.text||"");
    node.hidden=!missing.length;node.textContent=tr("Some characters are not included in this font. Choose a font for this script.");
  }
  function resizeStage(){
    if(mode!=="edit"||!root.isConnected)return;
    const dims=logical(),width=Math.max(160,scroll.clientWidth-(matchMedia("(max-width:700px)").matches?60:76)),height=focused?Math.max(90,scroll.clientHeight-54):matchMedia("(max-width:700px)").matches?360:530;
    fitScale=Math.min(width/dims.width,height/dims.height,.8);
    const factor=zoom==="fit"?fitScale:fitScale*Number(zoom),w=dims.width*factor,h=dims.height*factor;
    artboard.style.width=w+"px";artboard.style.height=h+"px";
    const wrap=artboard.parentElement;wrap.style.width=w+"px";wrap.style.height=h+"px";
    shell.style.setProperty("--cw-stage-scale",factor);
    paint();
  }
  function refresh(){
    if(disposed||!root.isConnected)return;
    // Starter layouts and completed uploads mutate through the shared adapter.
    // Capture those changes too, without persisting or calling the adapter again.
    if(!gesture&&!restoring)record();
    const key=instance.product().id+":"+adapter.surface();
    if(key!==activeKey){selected=null;activeKey=key;lastHistoryGroup=null;}
    if(selected&&!current())selected=null;
    shell.dataset.selectedLayer=selected||"";
    renderSurfaces();renderLayerList();renderInspector();resizeStage();
    if(!gesture)render();else paint();
    updateHistory();renderPreviewSelection();
  }
  async function addImages(files,point=null){
    if(!files?.length)return;
    if(!canAdd(files.length))return;
    if(shell.dataset.uploading)return;
    shell.dataset.uploading="true";setStatus("Preparing your images…");
    shell.querySelector("[data-ws-upload]").disabled=true;
    const targetProduct=instance.product().id,targetSide=adapter.surface();
    try{
      const added=await adapter.addImages(files);
      if(!root.isConnected)return;
      if(point&&instance.product().id===targetProduct&&adapter.surface()===targetSide){
        added?.forEach((layer,index)=>{layer.x=clamp(point.x+.024*index,0,1);layer.y=clamp(point.y+.024*index,0,1);});
      }
      selected=added?.at(-1)?.id||layers().at(-1)?.id||null;
      commit();setStatus("Images added");
    }
    catch(error){setStatus(error.message||"Could not load this layer.",true);}
    finally{delete shell.dataset.uploading;shell.querySelector("[data-ws-upload]").disabled=false;shell.querySelector("[data-ws-upload]").value="";}
  }
  function addText(style="body"){
    if(!canAdd())return;
    const layer={id:uid(),type:"text",text:tr(style==="heading"?"Write something wonderful":style==="detail"?"A little more you":"Your own text"),font:typeof currentLanguage==="function"&&currentLanguage()==="ar"?"arabic":"manrope",color:"#24212b",size:style==="heading"?.13:style==="detail"?.035:.075,x:.5,y:.5,rotation:0,opacity:1,visible:true,locked:false,align:"center",direction:"auto"};
    layers().push(layer);selected=layer.id;switchTool("text");commit();
    requestAnimationFrame(()=>{const field=inspector.querySelector("[data-ws-prop=text]");field?.focus({preventScroll:true});field?.select();});
  }
  function selectedAction(name){
    const layer=current();
    if(name==="undo"){restore(-1);return;}if(name==="redo"){restore(1);return;}
    if(!layer||layer.locked)return;
    const list=layers(),index=list.indexOf(layer);
    if(name==="delete"){list.splice(index,1);selected=null;}
    else if(name==="duplicate"){
      if(!canAdd())return;
      const copy={...cloneState(layer),id:uid(),x:clamp(layer.x+.025,0,1),y:clamp(layer.y+.025,0,1)};
      list.splice(index+1,0,copy);selected=copy.id;
    }else if(name==="forward"&&index<list.length-1){list.splice(index,1);list.splice(index+1,0,layer);}
    else if(name==="backward"&&index>0){list.splice(index,1);list.splice(index-1,0,layer);}
    else if(name==="centre-both"){layer.x=.5;layer.y=.5;}
    else if(name==="centre-x")layer.x=.5;
    else if(name==="centre-y")layer.y=.5;
    else if(["safe-left","safe-right","safe-top","safe-bottom"].includes(name)){
      const size=dimensions(layer),d=logical(),margin=.085;
      // Safe alignment uses the rotated bounding box seen by the customer.
      const angle=(Number(layer.rotation)||0)*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
      const w=Math.min(.5,(size.width*c+size.height*s)/(d.width*2));
      const h=Math.min(.5,(size.height*c+size.width*s)/(d.height*2));
      if(name==="safe-left")layer.x=clamp(margin+w,0,1);
      else if(name==="safe-right")layer.x=clamp(1-margin-w,0,1);
      else if(name==="safe-top")layer.y=clamp(margin+h,0,1);
      else layer.y=clamp(1-margin-h,0,1);
    }else return;
    commit();
  }
  function copyOtherSide(confirm=false){
    const sourceId=copyControls.querySelector("[data-ws-copy-side]").dataset.source,
      source=instance.state.scenes?.[instance.product().id]?.[sourceId],target=adapter.scene();
    if(!source?.layers?.length)return;
    if(target.layers.length&&!confirm){copyControls.querySelector("[data-ws-copy-confirm]").hidden=false;return;}
    if(totalLayers()-target.layers.length+source.layers.length>120){setStatus("Add up to 120 layers across this design.",true);return;}
    target.background=source.background;target.layers=source.layers.map(layer=>({...cloneState(layer),id:uid()}));
    selected=target.layers.at(-1)?.id||null;commit();
  }
  function changeProperty(input){
    const layer=current(),key=input.dataset.wsProp;
    if(!layer||layer.locked)return;
    if(["text","color","align","direction"].includes(key))layer[key]=input.value;
    else{
      const value=Number(input.value);if(!Number.isFinite(value)||input.value==="")return;
      if(key==="rotation")layer.rotation=clamp(value,-180,180);
      else if(key==="size")layer.size=clamp(value/100,.005,.5);
      else if(key==="tracking")layer.tracking=clamp(value/100,-.08,.3);
      else if(["width","height"].includes(key)){
        const next=clamp(value/100,.01,3),previous=layer[key];
        if(inspector.querySelector("[data-ws-proportions]")?.checked){const other=key==="width"?"height":"width";layer[other]=clamp(layer[other]*next/previous,.01,3);}
        layer[key]=next;
      }else layer[key]=clamp(value/100,0,1);
    }
    const count=inspector.querySelector("[data-ws-character-count]");if(count)count.textContent=layer.text?.length||0;
    checkGlyphs();commit("property:"+layer.id+":"+key);
  }
  function handlePoint(event){if(gesture?.preview){const point=previewPoint(event);return point&&{x:point.x,y:point.y};}const rect=artboard.getBoundingClientRect(),d=logical();return{x:(event.clientX-rect.left)/rect.width*d.width,y:(event.clientY-rect.top)/rect.height*d.height};}
  function rotatePoint(point,angle){const c=Math.cos(angle),s=Math.sin(angle);return{x:point.x*c-point.y*s,y:point.x*s+point.y*c};}
  function beginGesture(event){
    if(event.button!==0||mode!=="edit"||pinch)return;
    const handle=event.target.closest("[data-ws-handle]"),node=event.target.closest("[data-ws-layer]");
    if(!handle&&!node){selectLayer(null,{focus:true});return;}
    if(node)selectLayer(node.dataset.wsLayer,{focus:true});
    const layer=current();if(!layer||layer.locked||layer.visible===false)return;
    const point=handlePoint(event),d=logical(),bounds=dimensions(layer),original=cloneState(layer),kind=handle?.dataset.wsHandle||"move";
    gesture={id:layer.id,kind,point,original,bounds,before:snapshot(),pointer:event.pointerId};
    if(kind!=="move"&&kind!=="rotate"){
      const sx=kind.includes("e")?1:kind.includes("w")?-1:0,sy=kind.includes("s")?1:kind.includes("n")?-1:0,angle=layer.rotation*Math.PI/180,
        opposite=rotatePoint({x:-sx*bounds.width/2,y:-sy*bounds.height/2},angle);
      gesture.anchor={x:layer.x*d.width+opposite.x,y:layer.y*d.height+opposite.y};gesture.sx=sx;gesture.sy=sy;
    }
    artboard.setPointerCapture(event.pointerId);artboard.focus({preventScroll:true});event.preventDefault();
  }
  function moveGesture(event){
    if(!gesture||gesture.pointer!==event.pointerId)return;
    const layer=layers().find(l=>l.id===gesture.id);if(!layer)return;
    const point=handlePoint(event),d=logical(),o=gesture.original,g=gesture;
    if(!point)return;
    if(g.kind==="move"){
      layer.x=clamp(o.x+(point.x-g.point.x)/d.width,0,1);layer.y=clamp(o.y+(point.y-g.point.y)/d.height,0,1);
      // Shift locks to one logical axis in both flat and product-preview modes.
      // Alt bypasses magnetic guides without changing the stored preference.
      if(event.shiftKey){
        if(Math.abs(point.x-g.point.x)>=Math.abs(point.y-g.point.y))layer.y=o.y;
        else layer.x=o.x;
      }
      const useSnap=shell.querySelector("[data-ws-snap]").checked&&!event.altKey&&!event.shiftKey;
      if(g.preview){
        const snap=window.VeeladPreviewSnap;
        if(useSnap&&snap){
          const measures=item=>{const size=dimensions(item);return{width:size.width/d.width,height:size.height/d.height};};
          const proposed=snap.snap({x:layer.x,y:layer.y},layer,layers(),measures,{
            aspect:d.height/d.width,tolerance:Math.max(.016,8/Math.max(1,previewOverlay.clientWidth))
          });
          layer.x=proposed.x;layer.y=proposed.y;
          renderPreviewGuides(proposed.guides);
        }else renderPreviewGuides();
      }else{
        const guides=useSnap?instance.math.snapLayerPosition(
          {id:layer.id,x:layer.x*d.width,y:layer.y*d.height,...dimensions(layer),rotation:layer.rotation},
          layers().filter(other=>other.id!==layer.id&&other.visible!==false).map(other=>({
            id:other.id,x:other.x*d.width,y:other.y*d.height,...dimensions(other),rotation:other.rotation
          })),
          {width:d.width,height:d.height},
          {threshold:7*d.width/Math.max(1,artboard.getBoundingClientRect().width)}
        ):{guides:{x:null,y:null}};
        if(useSnap){layer.x=clamp(guides.x/d.width,0,1);layer.y=clamp(guides.y/d.height,0,1);}
        for(const axis of ["x","y"]){
          const node=shell.querySelector(".cw-centre-"+axis),line=guides.guides[axis];
          node.hidden=line===null;
          if(line!==null)node.style[axis==="x"?"left":"top"]=100*line/(axis==="x"?d.width:d.height)+"%";
        }
      }
    }else if(g.kind==="rotate"){
      const a=Math.atan2(point.y-o.y*d.height,point.x-o.x*d.width)*180/Math.PI+90;
      layer.rotation=clamp(event.shiftKey?Math.round(a/15)*15:a,-180,180);
    }else{
      const v=rotatePoint({x:point.x-g.anchor.x,y:point.y-g.anchor.y},-o.rotation*Math.PI/180),bw=g.bounds.width,bh=g.bounds.height;
      let w=g.sx?Math.max(9,v.x*g.sx):bw,h=g.sy?Math.max(9,v.y*g.sy):bh;
      if(layer.type==="text"||(g.sx!==0&&g.sy!==0&&!event.shiftKey)){const scale=clamp((v.x*g.sx*bw+v.y*g.sy*bh)/(bw*bw+bh*bh),.02,20);w=bw*scale;h=bh*scale;}
      if(layer.type==="image"){w=clamp(w/d.width,.01,3)*d.width;h=clamp(h/d.height,.01,3)*d.height;layer.width=w/d.width;layer.height=h/d.height;}
      else{layer.size=clamp(o.size*w/bw,.005,.5);w=bw*layer.size/o.size;h=bh*layer.size/o.size;}
      const delta=rotatePoint({x:g.sx*w/2,y:g.sy*h/2},o.rotation*Math.PI/180);
      layer.x=clamp((g.anchor.x+delta.x)/d.width,0,1);layer.y=clamp((g.anchor.y+delta.y)/d.height,0,1);
    }
    if(gesture.preview){renderPreviewSelection();schedulePreviewRender();}else paint();event.preventDefault();
  }
  function cancelGesture(){
    const g=gesture;
    if(!g)return false;
    gesture=null;
    const layer=layers().find(item=>item.id===g.id);
    if(layer)Object.assign(layer,g.original);
    shell.querySelectorAll(".cw-centre-line").forEach(node=>node.hidden=true);
    renderPreviewGuides();
    const target=g.preview?previewOverlay:artboard;
    if(target.hasPointerCapture?.(g.pointer))target.releasePointerCapture(g.pointer);
    renderInspector();render();
    if(g.preview){renderPreviewSelection();void instance.render?.();}
    return true;
  }
  function finishGesture(event){
    if(!gesture||event.pointerId!==gesture.pointer)return;
    if(event.type==="pointercancel"){cancelGesture();return;}
    const g=gesture;gesture=null;
    shell.querySelectorAll(".cw-centre-line").forEach(node=>node.hidden=true);
    renderPreviewGuides();
    if(snapshot()!==g.before)commit();
    renderInspector();render();
    if(g.preview){renderPreviewSelection();void instance.render?.();}
  }
  function keyboard(event){
    if(event.key==="Escape"){
      if(cancelGesture()){event.preventDefault();return;}
      if(focused){event.preventDefault();setFocus(false);return;}
    }
    if(event.target.closest("input,textarea,select,[contenteditable=true]"))return;
    if(event.target.closest('[data-ws-font]')&&['ArrowUp','ArrowDown','Home','End'].includes(event.key)){
      const options=[...shell.querySelectorAll('[data-ws-font]')],index=options.indexOf(event.target.closest('[data-ws-font]'));
      const next=event.key==='Home'?0:event.key==='End'?options.length-1:clamp(index+(event.key==='ArrowDown'?1:-1),0,options.length-1);
      event.preventDefault();options[next]?.focus();return;
    }
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"){event.preventDefault();restore(event.shiftKey?1:-1);return;}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="y"){event.preventDefault();restore(1);return;}
    const layer=current();if(!layer||layer.locked)return;
    if(event.key==="Delete"||event.key==="Backspace"){event.preventDefault();selectedAction("delete");return;}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="d"){event.preventDefault();selectedAction("duplicate");return;}
    const move={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if(!move)return;event.preventDefault();const amount=event.shiftKey?.02:.002;
    layer.x=clamp(layer.x+move[0]*amount,0,1);layer.y=clamp(layer.y+move[1]*amount,0,1);commit("keyboard:"+layer.id);
  }
  function renderFonts(){
    if(!fontsReady||tool!=="fonts")return;
    const api=window.VeeladFonts,query=shell.querySelector("[data-ws-font-search]").value,
      script=shell.querySelector("[data-ws-font-script]").value,category=shell.querySelector("[data-ws-font-category]").value,
      matches=api.search(query,{script,category}),list=matches.slice(0,fontLimit),chosen=current();
    const node=shell.querySelector("[data-ws-font-results]");fontObserver?.disconnect();
    node.innerHTML=list.length?list.map(font=>{const sample=chosen?.type==="text"&&chosen.text&&api.supports(font.id,chosen.text)?chosen.text.slice(0,65):font.sample;return `<button type="button" class="cw-font-option" data-ws-font="${esc(font.id)}" role="option" aria-selected="${chosen?.font===font.id}"><span class="cw-font-label">${esc(font.label)}<small>${esc(font.scripts.join(" · "))}</small></span><span class="cw-font-sample" data-ws-font-sample="${esc(font.id)}" dir="auto">${esc(sample)}</span></button>`;}).join("")+(matches.length>fontLimit?`<button type="button" class="cw-button cw-load-fonts" data-ws-more-fonts>${tr("Load more fonts")}</button>`:""):`<p class="cw-muted">${tr("No fonts match. Try another search.")}</p>`;
    shell.querySelector("[data-ws-font-hint]").hidden=chosen?.type==="text";
    const loadSample=async sample=>{try{const family=await api.load(sample.dataset.wsFontSample);if(sample.isConnected)sample.style.fontFamily='"'+family+'", sans-serif';}catch{}};
    if(typeof IntersectionObserver!=="undefined"){
      fontObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){fontObserver.unobserve(entry.target);loadSample(entry.target);}},{root:shell.querySelector(".cw-panel-content"),rootMargin:"60px"});
      node.querySelectorAll("[data-ws-font-sample]").forEach(sample=>fontObserver.observe(sample));
    }else node.querySelectorAll("[data-ws-font-sample]").forEach((sample,index)=>{if(index<6)loadSample(sample);});
  }
  async function initFonts(){
    try{
      if(!window.VeeladFonts)throw Error("Font library missing");
      await window.VeeladFonts.ready;if(!root.isConnected)return;fontsReady=true;
      const names=window.VeeladFonts.scriptNames(),codes=[...new Set(window.VeeladFonts.catalogue().flatMap(font=>font.scripts))];
      shell.querySelector("[data-ws-font-script]").innerHTML=`<option value="">${tr("All scripts")}</option>`+codes.sort((a,b)=>(names[a]||a).localeCompare(names[b]||b)).map(code=>`<option value="${esc(code)}">${esc(names[code]||code)}</option>`).join("");
      renderFonts();checkGlyphs();
    }catch{shell.querySelector("[data-ws-font-results]").textContent=tr("Font library is unavailable. Try again shortly.");}
  }
  shell.addEventListener("click",async event=>{
    const button=event.target.closest("button");if(!button)return;
    if(button.hasAttribute("data-ws-tool"))switchTool(button.dataset.wsTool);
    else if(button.hasAttribute("data-ws-close-panel"))shell.dataset.panelOpen="false";
    else if(button.hasAttribute("data-ws-mode"))setMode(button.dataset.wsMode);
    else if(button.hasAttribute("data-ws-review")){if(focused)setFocus(false);const review=form.querySelector("#customer-review");requestAnimationFrame(()=>{review?.scrollIntoView({block:"start",behavior:matchMedia("(prefers-reduced-motion:reduce)").matches?"instant":"smooth"});review?.focus({preventScroll:true});});}
    else if(button.hasAttribute("data-ws-focus"))setFocus(!focused);
    else if(button.hasAttribute("data-ws-surface")){adapter.setSurface(button.dataset.wsSurface);selected=null;commit();}
    else if(button.hasAttribute("data-ws-copy-side"))copyOtherSide();
    else if(button.hasAttribute("data-ws-placement-preset"))placeSelectedArtwork(button.dataset.wsPlacementPreset);
    else if(button.hasAttribute("data-ws-fit-safe"))placeSelectedArtwork("safe-fit");
    else if(button.hasAttribute("data-ws-copy-layer"))copySelectedLayerToOppositeSide();
    else if(button.hasAttribute("data-ws-confirm-copy"))copyOtherSide(true);
    else if(button.hasAttribute("data-ws-cancel-copy"))copyControls.querySelector("[data-ws-copy-confirm]").hidden=true;
    else if(button.hasAttribute("data-ws-choose-files"))shell.querySelector("[data-ws-upload]").click();
    else if(button.hasAttribute("data-ws-element"))await addElement(button.dataset.wsElement);
    else if(button.hasAttribute("data-ws-elements-view")){elementsView=button.dataset.wsElementsView;elementLimit=48;renderElements();}
    else if(button.hasAttribute("data-ws-favourite")){window.VeeladStudioPro?.favourite(button.dataset.wsFavourite);renderElements();}
    else if(button.hasAttribute("data-ws-pro-layout"))await applyProLayout(button.dataset.wsProLayout);
    else if(button.hasAttribute("data-ws-original-apply"))await applyOriginalDrop(button.dataset.wsOriginalApply);
    else if(button.hasAttribute("data-ws-original-drop-more")){originalLimit+=24;renderOriginalDropCards();}
    else if(button.hasAttribute("data-ws-save-palette")){
      const layer=current(),colour=window.VeeladColourTools;
      if(layer?.library_element&&colour){const c=layer.library_element.colors;colour.save([c.primary,c.secondary,c.accent]);renderInspector();setStatus("Palette saved locally");}
    }
    else if(button.hasAttribute("data-ws-extract-palette")){
      const layer=current(),imageLayer=layers().find(item=>item.type==="image"&&!item.library_element),tools=window.VeeladColourTools;
      if(layer?.library_element&&imageLayer?.upload_id&&tools){
        try{
          setStatus("Extracting palette locally…");const image=await adapter.image(imageLayer.upload_id);
          const canvas=document.createElement("canvas");canvas.width=canvas.height=64;
          const context=canvas.getContext("2d",{willReadFrequently:true});if(!context)throw Error("Canvas unavailable");
          context.clearRect(0,0,64,64);context.drawImage(image,0,0,64,64);
          const colors=tools.extract(context.getImageData(0,0,64,64).data);tools.save(colors);
          await recolourPalette(layer.id,{primary:colors[0],secondary:colors[1],accent:colors[2]});
          setStatus("Palette applied");
        }catch{setStatus("Could not extract colours from this photo.",true);}
      }
    }
    else if(button.hasAttribute("data-ws-palette")){
      const layer=current(),palette=[...(window.VeeladStudioPro?.palettes||[]),...(window.VeeladColourTools?.read()||[])].find(p=>p.id===button.dataset.wsPalette);
      if(layer?.library_element&&palette){
        const original=window.VeeladElements.defaults(layer.library_element.id),colors=palette.colors||[original.primary,original.secondary,original.accent];
        await recolourPalette(layer.id,{primary:colors[0],secondary:colors[1],accent:colors[2]});
      }
    }

    else if(button.hasAttribute("data-ws-element-more")){elementLimit+=48;renderElements();}
    else if(button.hasAttribute("data-ws-add-text"))addText(button.dataset.wsAddText);
    else if(button.hasAttribute("data-ws-open-fonts"))switchTool("fonts");
    else if(button.hasAttribute("data-ws-action"))selectedAction(button.dataset.wsAction);
    else if(button.hasAttribute("data-ws-select"))selectLayer(button.dataset.wsSelect,{focus:true});
    else if(button.hasAttribute("data-ws-toggle-visible")){const layer=layers().find(l=>l.id===button.dataset.wsToggleVisible);layer.visible=layer.visible===false;commit();}
    else if(button.hasAttribute("data-ws-toggle-lock")){const layer=layers().find(l=>l.id===button.dataset.wsToggleLock);layer.locked=!layer.locked;commit();}
    else if(button.hasAttribute("data-ws-reuse"))await reuseImage(button.dataset.wsReuse);
    else if(button.hasAttribute("data-ws-font")){
      let layer=current();if(layer?.type!=="text"){addText();layer=current();switchTool("fonts");}
      if(layer?.locked)return;
      layer.font=button.dataset.wsFont;commit();renderFonts();window.VeeladFonts.load(layer.font).catch(()=>{});
    }else if(button.hasAttribute("data-ws-more-fonts")){fontLimit+=60;renderFonts();}
    else if(button.hasAttribute("data-ws-fit")){zoom="fit";shell.querySelector("[data-ws-zoom]").value="fit";resizeStage();scroll.scrollTo({left:0,top:0});}
  });
  shell.addEventListener("input",event=>{
    const input=event.target;
    if(input.hasAttribute("data-ws-prop"))changeProperty(input);
    else if(input.hasAttribute("data-ws-font-search")){fontLimit=60;renderFonts();}
    else if(input.hasAttribute("data-ws-element-search")){elementLimit=48;renderElements();}
    else if(input.hasAttribute("data-ws-original-query")){originalQuery=input.value;originalLimit=24;renderOriginalDropCards();}
    else if(input.hasAttribute("data-ws-background")){adapter.scene().background=input.value;shell.querySelector("[data-ws-transparent]").checked=false;commit("background");}
  });
  shell.addEventListener("change",event=>{
    const input=event.target;
    if(input.hasAttribute("data-ws-upload"))addImages(input.files);
    else if(input.hasAttribute("data-ws-element-category")){elementLimit=48;renderElements();}
    else if(input.hasAttribute("data-ws-element-collection")){elementLimit=48;renderElements();}
    else if(input.hasAttribute("data-ws-original-collection")){originalCollection=input.value;originalLimit=24;renderOriginalDropCards();}
    else if(input.hasAttribute("data-ws-element-colour")){const layer=current();if(layer)void recolourElement(layer.id,input.dataset.wsElementColour,input.value);}
    else if(input.hasAttribute("data-ws-zoom")){zoom=input.value;resizeStage();}
    else if(input.matches("[data-ws-font-script],[data-ws-font-category]")){fontLimit=60;renderFonts();}
    else if(input.hasAttribute("data-ws-transparent")){adapter.scene().background=input.checked?"transparent":shell.querySelector("[data-ws-background]").value;commit();}
    else if(input.hasAttribute("data-ws-guides"))shell.querySelector(".cw-safe-area").hidden=!input.checked;
    else if(input.hasAttribute("data-ws-prop")){lastHistoryGroup=null;renderInspector();}
  });
  shell.addEventListener("focusout",event=>{if(event.target.hasAttribute("data-ws-prop"))requestAnimationFrame(()=>renderInspector());});
  for(const name of ["dragenter","dragover"])shell.addEventListener(name,event=>{if(!event.dataTransfer?.types.includes("Files"))return;event.preventDefault();shell.classList.add("cw-is-dragging");});
  shell.addEventListener("dragleave",event=>{if(!shell.contains(event.relatedTarget))shell.classList.remove("cw-is-dragging");});
  shell.addEventListener("drop",event=>{if(!event.dataTransfer?.files.length)return;event.preventDefault();event.stopPropagation();shell.classList.remove("cw-is-dragging");addImages(event.dataTransfer.files);});
shell.addEventListener("dragstart",event=>{
    if(!event.dataTransfer)return;
    const element=event.target.closest("[data-ws-element]"),
      upload=event.target.closest("[data-ws-reuse]");
    const row=event.target.closest("[data-ws-sort-layer]");
    if(row&&!event.target.closest("[data-ws-toggle-lock], [data-ws-toggle-visible]")){
      const layer=layers().find(item=>item.id===row.dataset.wsSortLayer);
      if(!layer||layer.locked){event.preventDefault();return;}
      event.dataTransfer.setData("application/x-veelad-layer",layer.id);
      event.dataTransfer.effectAllowed="move";
      row.dataset.dragging="true";return;
    }
    if(element)event.dataTransfer.setData("application/x-veelad-element",element.dataset.wsElement);
    else if(upload)event.dataTransfer.setData("application/x-veelad-upload",upload.dataset.wsReuse);
    else return;
    event.dataTransfer.effectAllowed="copy";
  });
  shell.addEventListener("dragover",event=>{
    const row=event.target.closest("[data-ws-sort-layer]");
    if(!row||!event.dataTransfer?.types.includes("application/x-veelad-layer"))return;
    const rect=row.getBoundingClientRect();
    const after=event.clientY>rect.top+rect.height/2;
    event.preventDefault();event.dataTransfer.dropEffect="move";
    shell.querySelectorAll("[data-ws-sort-layer]").forEach(other=>{
      if(other!==row)delete other.dataset.dropEdge;
    });
    row.dataset.dropEdge=after?"after":"before";
  });
  shell.addEventListener("drop",event=>{
    const row=event.target.closest("[data-ws-sort-layer]");
    if(!row||!event.dataTransfer?.types.includes("application/x-veelad-layer"))return;
    const source=event.dataTransfer.getData("application/x-veelad-layer");
    const target=row.dataset.wsSortLayer;
    const rect=row.getBoundingClientRect(),after=event.clientY>rect.top+rect.height/2;
    event.preventDefault();event.stopPropagation();
    shell.querySelectorAll("[data-ws-sort-layer]").forEach(item=>delete item.dataset.dropEdge);
    reorderLayers(source,target,after);
  });
  shell.addEventListener("dragend",()=>{
    shell.querySelectorAll("[data-ws-sort-layer]").forEach(item=>{
      delete item.dataset.dropEdge;delete item.dataset.dragging;
    });
  });
  shell.addEventListener("keydown",event=>{
    if(!event.altKey||!event.shiftKey||!["ArrowUp","ArrowDown"].includes(event.key))return;
    const row=event.target.closest("[data-ws-sort-layer]");if(!row)return;
    const shown=[...layers()].reverse(),index=shown.findIndex(l=>l.id===row.dataset.wsSortLayer);
    const target=shown[index+(event.key==="ArrowUp"?-1:1)];
    if(!target)return;
    event.preventDefault();event.stopImmediatePropagation();
    const id=row.dataset.wsSortLayer;
    if(reorderLayers(id,target.id,event.key==="ArrowDown"))requestAnimationFrame(()=>{
      [...shell.querySelectorAll("[data-ws-sort-layer]")].find(x=>x.dataset.wsSortLayer===id)?.querySelector(".cw-layer-pick")?.focus();
    });
  },true);
  artboard.addEventListener("dragover",event=>{
    if(event.dataTransfer?.types.includes("application/x-veelad-element")){event.preventDefault();event.dataTransfer.dropEffect="copy";}
  });
  artboard.addEventListener("drop",event=>{
    const value=event.dataTransfer?.getData("application/x-veelad-element");
    if(!window.VeeladElements?.find(value))return;
    event.preventDefault();event.stopPropagation();
    const rect=artboard.getBoundingClientRect();
    void addElement(value,{x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height});
  });
  // Drag in original assets or private photos directly onto the garment.
  // Convert the drop position to print-space UV, not mockup pixels.
  previewOverlay.addEventListener("dragover",event=>{
    const types=event.dataTransfer?.types;
    if(types?.includes("application/x-veelad-element")||types?.includes("application/x-veelad-upload")||types?.includes("Files")){
      event.preventDefault();event.dataTransfer.dropEffect="copy";
      previewOverlay.classList.add("cw-preview-drop-active");
    }
  });
  previewOverlay.addEventListener("dragleave",event=>{
    if(!previewOverlay.contains(event.relatedTarget))previewOverlay.classList.remove("cw-preview-drop-active");
  });
  previewOverlay.addEventListener("drop",event=>{
    previewOverlay.classList.remove("cw-preview-drop-active");
    shell.classList.remove("cw-is-dragging");
    const value=event.dataTransfer?.getData("application/x-veelad-element"),
      upload=event.dataTransfer?.getData("application/x-veelad-upload"),
      files=event.dataTransfer?.files,point=previewPoint(event)?.uv||{x:.5,y:.5};
    if(value&&window.VeeladElements?.find(value)){
      event.preventDefault();event.stopPropagation();
      void addElement(value,point);
    }else if(upload){
      event.preventDefault();event.stopPropagation();
      void reuseImage(upload,point);
    }else if(files?.length){
      event.preventDefault();event.stopPropagation();
      void addImages(files,point);
    }
  });
  previewOverlay.addEventListener("pointerdown",beginPreviewGesture);
  previewOverlay.addEventListener("pointermove",movePreviewGesture);
  for(const name of ["pointerup","pointercancel","lostpointercapture"])previewOverlay.addEventListener(name,finishGesture);
  root.addEventListener("customer-scene-rendered",()=>{if(mode==="preview")renderPreviewSelection();});
  artboard.addEventListener("pointerdown",beginGesture);artboard.addEventListener("pointermove",moveGesture);
  for(const name of ["pointerup","pointercancel","lostpointercapture"])artboard.addEventListener(name,finishGesture);
  // Two-finger zoom works on touch screens without generating layer edits.
  // A second pointer cancels the first layer gesture, preserving undo history.
  const touchPointers=new Map();
  let pinch=null;
  function touchStart(event){
    if(event.pointerType!=="touch"||mode!=="edit")return;
    touchPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(touchPointers.size===2){
      if(gesture)finishGesture({type:"pointercancel",pointerId:gesture.pointer});
      const points=[...touchPointers.values()],distance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
      pinch={distance:Math.max(distance,8),factor:zoom==="fit"?1:Number(zoom)};
      event.stopImmediatePropagation();event.preventDefault();
    }
  }
  function touchMove(event){
    if(event.pointerType!=="touch"||!touchPointers.has(event.pointerId))return;
    touchPointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(!pinch||touchPointers.size<2)return;
    const points=[...touchPointers.values()],
      distance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y),
      factor=clamp(pinch.factor*distance/pinch.distance,.5,3);
    if(Number.isFinite(factor)){
      zoom=String(Math.round(factor*20)/20);
      const control=shell.querySelector("[data-ws-zoom]");
      if(control){let option=[...control.options].find(o=>o.value===zoom);if(!option){
        option=document.createElement("option");option.value=zoom;option.textContent=Math.round(factor*100)+"%";
        control.append(option);
      }control.value=zoom;}
      resizeStage();
    }
    event.stopImmediatePropagation();event.preventDefault();
  }
  function touchEnd(event){
    if(event.pointerType!=="touch")return;
    touchPointers.delete(event.pointerId);
    if(touchPointers.size<2)pinch=null;
  }
  for(const name of ["pointerdown"])artboard.addEventListener(name,touchStart,true);
  artboard.addEventListener("pointermove",touchMove,true);
  for(const name of ["pointerup","pointercancel","lostpointercapture"])artboard.addEventListener(name,touchEnd,true);
  shell.addEventListener("keydown",keyboard);
  root.addEventListener("scene-editor-change",()=>{if(!gesture){record();refresh();}});
  const resizeObserver=typeof ResizeObserver!=="undefined"?new ResizeObserver(()=>resizeStage()):null;
  resizeObserver?.observe(scroll);
  if(previewCanvas)resizeObserver?.observe(previewCanvas);
  const lifecycle=new MutationObserver(()=>{if(!root.isConnected)instance.workspace?.dispose();});
  lifecycle.observe(document.querySelector("#app")||document.body,{childList:true});
  instance.workspace={refresh,render,addText,select:selectLayer,selected:()=>selected,undo:()=>restore(-1),redo:()=>restore(1),dispose(){disposed=true;document.body.classList.remove("has-studio-focus");clearTimeout(qualityTimer);resizeObserver?.disconnect();fontObserver?.disconnect();lifecycle.disconnect();}};
  shell.dataset.panelOpen="true";shell.dataset.mode="edit";shell.dataset.tool="uploads";
  record();refresh();initFonts();
  if(window.VeeladElements){renderElements();renderProLayouts();}
  // A public Originals gallery link opens this design in the filtered gallery.
  // Never silently overwrite an existing draft or add layers without consent.
  const requestedDrop=new URLSearchParams(location.search).get('drop');
  const featuredDrop=window.VeeladOriginalDrops?.find(requestedDrop);
  if(featuredDrop){
    originalCollection=featuredDrop.collection;
    originalQuery=featuredDrop.name;
    switchTool('layouts');
  }
}
