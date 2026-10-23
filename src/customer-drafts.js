import {
  ApiError,
  fail,
  text,
  integer,
  uid,
  json,
  product,
  now,
} from "./security.js";
import {
  validateDesignStudio,
  mockupId,
  printProductFor,
} from "./design-studio.js";
import { artworkRenderSource, artworkPreview } from "./artwork.js";
import { renderMockup, ensureMockup } from "./mockup-renderer.js";
import { privateDirectory } from "./operations.js";
import { hasText } from "./text-layers.js";
import {sceneVersion,sceneSourceIds,sceneHasContent,ownedSceneSources} from "./design-scenes.js";

const draftConflict = () => {
  throw Object.assign(
    new ApiError(
      409,
      "This draft changed in another tab. Reload it or save a copy.",
    ),
    { publicCode: "DRAFT_CONFLICT" },
  );
};
const draftValue = (row) =>
  row
    ? {
        id: row.id,
        product_id: row.product_id,
        revision: row.revision,
        updated_at: row.updated_at,
        ...json(row.data),
      }
    : null;
const baseValue = (p) =>
  p
    ? {
        id: p.id,
        title: p.title,
        title_ar: p.title_ar,
        category: p.category,
        price: p.price,
        stock: p.stock,
        status: p.status,
        variants: p.variants,
        customer_customizable: p.customer_customizable === true,
        ...(p.purchase_options?{purchase_options:p.purchase_options}:{}),
      }
    : null;
export async function customerDraftRoute({
  route,
  method,
  v,
  req,
  res,
  u,
  db,
  c,
}) {
  if (route === "customer-library" && method === "GET") {
    const page = integer(
        Number(req.query.page || 0),
        0,
        100000,
        "library page",
      ),
      offset = page * 24;
    const draftCount = Number(
        (
          await db.one(
            "SELECT COUNT(*) AS n FROM customer_design_drafts WHERE user_id=? AND archived=0",
            [u.id],
          )
        ).n,
      ),
      designCount = Number(
        (
          await db.one(
            "SELECT COUNT(*) AS n FROM customer_designs WHERE user_id=?",
            [u.id],
          )
        ).n,
      );
    const drafts = await db.q(
      "SELECT * FROM customer_design_drafts WHERE user_id=? AND archived=0 ORDER BY updated_at DESC,id LIMIT 24 OFFSET ?",
      [u.id, offset],
    );
    const designs = await db.q(
      "SELECT * FROM customer_designs WHERE user_id=? ORDER BY created_at DESC,id LIMIT 24 OFFSET ?",
      [u.id, offset],
    );
    res.json({
      page,
      has_more: Math.max(draftCount, designCount) > offset + 24,
      drafts: drafts.map(draftValue),
      designs: designs.map((row) => ({
        id: row.id,
        product_id: row.product_id,
        created_at: row.created_at,
        ...json(row.data),
      })),
    });
    return;
  }
  if (route === "customer-draft" && method === "GET") {
    if (req.query.copy) {
      const row = await db.one(
        "SELECT * FROM customer_designs WHERE id=? AND user_id=?",
        [String(req.query.copy), u.id],
      );
      if (!row) fail(404, "Personal design not found.");
      const data = json(row.data);
      const p = await db.one("SELECT * FROM products WHERE id=?", [
        row.product_id,
      ]);
      res.json({
        draft: {
          ...data,
          id: null,
          product_id: row.product_id,
          revision: 0,
          title: data.title || "",
          variant: productOrNull(p)?.variants?.[0] || "Standard",
        },
        product: baseValue(productOrNull(p)),
      });
      return;
    }
    const row = req.query.id
      ? await db.one(
          "SELECT * FROM customer_design_drafts WHERE id=? AND user_id=? AND archived=0",
          [String(req.query.id), u.id],
        )
      : await db.one(
          "SELECT * FROM customer_design_drafts WHERE user_id=? AND archived=0 ORDER BY updated_at DESC,id LIMIT 1",
          [u.id],
        );
    if (req.query.id && !row) fail(404, "Draft not found.");
    const p = row
      ? await db.one("SELECT * FROM products WHERE id=?", [row.product_id])
      : null;
    res.json({ draft: draftValue(row), product: baseValue(productOrNull(p)) });
    return;
  }
  if (route === "customer-draft" && method === "POST") {
    const id = v.id ? text(v, "id", 64) : uid("draft-");
    if (!/^draft-[a-f0-9-]{12,48}$/i.test(id))
      fail(422, "Please check the draft.");
    const revision = integer(v.revision ?? 0, 0, 10000000, "draft revision");
    if (v.action === "archive") {
      const result = await db.q(
        "UPDATE customer_design_drafts SET archived=1,revision=revision+1,updated_at=? WHERE id=? AND user_id=? AND revision=? AND archived=0",
        [now(), id, u.id, revision],
      );
      if (!result.affectedRows) draftConflict();
      res.json({ ok: true });
      return;
    }
    const productId = text(v, "product_id", 64),
      row = await db.one("SELECT * FROM products WHERE id=?", [productId]),
      p = productOrNull(row);
    const previous = await db.one(
      "SELECT * FROM customer_design_drafts WHERE id=? AND user_id=? AND archived=0",
      [id, u.id],
    );
    if (
      !p ||
      ((!previous || previous.product_id !== p.id) &&
        (p.status !== "active" || p.customer_customizable !== true))
    )
      fail(409, "Choose an available customizable product.");
    if (typeof v.title !== "string" || [...v.title].length > 80)
      fail(422, "Name your design using up to 80 characters.");
    const source = v.upload_id ? text(v, "upload_id", 64) : null;
    if (source) {
      const image = await db.one(
        "SELECT id FROM uploads WHERE id=? AND user_id=?",
        [source, u.id],
      );
      if (!image || !source.startsWith("art-")) fail(404, "Artwork not found.");
    }
    const studio = validateDesignStudio(v.design_studio, source),
      variant = text(v, "variant", 50, false) || p.variants[0];
    if (!p.variants.includes(variant)) fail(422, "Choose a valid option.");
    if(studio.scene_version===sceneVersion)await ownedSceneSources(db,studio,source,u.id);
    const data = {
        title: v.title.trim(),
        category: p.category,
        variant,
        upload_id: source,
        ...(studio.scene_version===sceneVersion?{source_upload_ids:sceneSourceIds(studio)}:{}),
        design_studio: studio,
      },
      updated = now();
    await db.tx(async (conn) => {
      await db.q("SELECT id FROM users WHERE id=? FOR UPDATE", [u.id], conn);
      const current = await db.one(
        "SELECT * FROM customer_design_drafts WHERE id=? FOR UPDATE",
        [id],
        conn,
      );
      if (current && (current.user_id !== u.id || current.archived))
        fail(404, "Draft not found.");
      if (current ? current.revision !== revision : revision !== 0)
        draftConflict();
      if (!current) {
        const count = await db.one(
          "SELECT COUNT(*) AS n FROM customer_design_drafts WHERE user_id=? AND archived=0",
          [u.id],
          conn,
        );
        if (Number(count.n) >= 100)
          fail(
            409,
            "Your draft library is full. Remove an unused draft first.",
          );
        await db.q(
          "INSERT INTO customer_design_drafts VALUES (?,?,?,?,?,0,?)",
          [id, u.id, p.id, JSON.stringify(data), 1, updated],
          conn,
        );
      } else
        await db.q(
          "UPDATE customer_design_drafts SET product_id=?,data=?,revision=revision+1,updated_at=? WHERE id=?",
          [p.id, JSON.stringify(data), updated, id],
          conn,
        );
    });
    res.json({ id, revision: revision + 1, updated_at: updated });
    return;
  }
  if (route === "customer-draft-preview" && method === "GET") {
    const row = await db.one(
      "SELECT * FROM customer_design_drafts WHERE id=? AND user_id=? AND archived=0",
      [String(req.query.id || ""), u.id],
    );
    if (!row) fail(404, "Draft not found.");
    const d = json(row.data),
      p = printProductFor(d.category);
    if (!p) fail(404, "Draft not found.");
    const image = d.upload_id
      ? await db.one("SELECT * FROM uploads WHERE id=? AND user_id=?", [
          d.upload_id,
          u.id,
        ])
      : null;
    if (d.upload_id && !image) fail(404, "Artwork not found.");
    const records=d.design_studio?.scene_version===sceneVersion?await ownedSceneSources(db,d.design_studio,d.upload_id,u.id):null;
    if (!image && !hasText(d.design_studio, p.id)&&!sceneHasContent(d.design_studio,p.id))
      fail(404, "Add artwork or text to preview your design.");
    const id = mockupId(
      image?.id || "text-" + u.id,
      d.category,
      d.design_studio,
    );
    await privateDirectory(c, c.uploadDir);
    await ensureMockup(c, db, id, u.id, async () =>
      renderMockup(
        image ? await artworkRenderSource(c.uploadDir, image) : null,
        d.category,
        d.design_studio,
        records?{resolveSource:async id=>{const record=records.get(id);if(!record)fail(404,"Artwork not found.");return artworkRenderSource(c.uploadDir,record);}}:{},
      ),
    );
    const preview = await db.one("SELECT * FROM uploads WHERE id=?", [id]);
    res.type("image/webp").send(await artworkPreview(c.uploadDir, preview));
    return;
  }
  fail(404, "Endpoint not found.");
}
function productOrNull(row) {
  return row ? product(row) : null;
}
