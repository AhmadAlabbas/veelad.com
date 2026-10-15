import { createHash } from "node:crypto";
import {
  fail,
  uid,
  text,
  integer,
  json,
  order,
  now,
  hash,
  equal,
} from "./security.js";
import { artworkMetadata, artworkPreview, readArtwork } from "./artwork.js";
import { hasText } from "./text-layers.js";
import { printProductFor } from "./design-studio.js";

export const productionStages = [
  "preparing",
  "awaiting_approval",
  "ready",
  "printing",
  "quality_check",
  "packed",
];
export const productionChecks = [
  "originals",
  "placement",
  "options",
  "print_quality",
  "packaging",
];
export const productionState = (data) =>
  data.production || {
    revision: 0,
    stage: "preparing",
    checks: {},
    internal_notes: "",
    customer_note: "",
    proofs: [],
    history: [],
  };
export function customerOrder(row) {
  const result = order(row);
  if (result.production) {
    const p = result.production;
    result.production = {
      revision: p.revision,
      stage: p.stage,
      customer_note: p.customer_note,
      proofs: p.proofs.map(
        ({
          id,
          line_id,
          caption,
          status,
          created_at,
          decided_at,
          feedback,
        }) => ({
          id,
          line_id,
          caption,
          status,
          created_at,
          decided_at,
          feedback,
        }),
      ),
      history: p.history
        .filter((h) => h.public)
        .map(({ at, stage }) => ({ at, stage })),
    };
  }
  return result;
}
export function assertProductionReady(data, next) {
  const p = productionState(data),
    latest = data.items.map((item) =>
      p.proofs.filter((proof) => proof.line_id === item.line_id).at(-1),
    );
  if (["ready", "printing", "quality_check", "packed"].includes(next)) {
    if (latest.some((proof) => !proof || proof.status !== "approved"))
      fail(409, "Every order item needs an approved final proof.");
    if (
      ["originals", "placement", "options"].some(
        (key) => p.checks[key] !== true,
      )
    )
      fail(409, "Complete the preparation checklist first.");
  }
  if (
    ["printing", "quality_check", "packed"].includes(next) &&
    data.payment_status !== "paid"
  )
    fail(409, "Payment confirmation is required before printing.");
  if (["quality_check", "packed"].includes(next) && !p.checks.print_quality)
    fail(409, "Confirm print quality before moving forward.");
  if (next === "packed" && !p.checks.packaging)
    fail(409, "Confirm packaging before marking the order packed.");
}
export async function productionRoute({
  route,
  method,
  v,
  req,
  res,
  u,
  db,
  c,
  audit,
}) {
  const query = method === "GET" ? req.query : v,
    id = text(query, "id", 64);
  async function accessible(conn) {
    const row = await db.one(
        "SELECT * FROM orders WHERE id=?" + (conn ? " FOR UPDATE" : ""),
        [id],
        conn,
      ),
      token = String(query.token || "");
    if (
      !row ||
      !(
        u?.role === "admin" ||
        u?.id === row.user_id ||
        (token && equal(row.guest_hash, hash(token)))
      )
    )
      fail(404, "Order not found. Sign in or use your private tracking code.");
    return row;
  }
  const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
  async function verifiedProof(proof, conn) {
    const image = await db.one(
      "SELECT * FROM uploads WHERE id=?",
      [proof.upload_id],
      conn,
    );
    if (!image) fail(404, "Artwork not found.");
    const bytes = await readArtwork(c.uploadDir, image);
    if (proof.sha256 && digest(bytes) !== proof.sha256)
      fail(409, "The proof file changed. Ask the store team for a new proof.");
    return image;
  }
  if (route === "order-proof-image" && method === "GET") {
    const row = await accessible(),
      proof = productionState(json(row.data)).proofs.find(
        (p) => p.id === req.query.proof,
      );
    if (!proof) fail(404, "Proof not found.");
    const image = await verifiedProof(proof);
    return res
      .type("image/webp")
      .send(await artworkPreview(c.uploadDir, image));
  }
  if (method !== "POST") fail(404, "Route not found.");
  if (route === "admin-production" && u?.role !== "admin")
    fail(403, "This area is restricted to your account role.");
  const result = await db.tx(async (conn) => {
    const row = await accessible(conn),
      data = json(row.data),
      p = structuredClone(productionState(data));
    if (["cancelled", "delivered", "shipped"].includes(row.status))
      fail(409, "This order is closed for production changes.");
    if (integer(v.revision, 0, 100000, "revision") !== p.revision)
      fail(409, "This order changed. Reload it before saving.");
    // Legacy order lines gain stable IDs once, inside the same locked transaction.
    data.items.forEach((item, i) => (item.line_id ||= row.id + "-line-" + i));
    if (route === "admin-production") {
      if (v.action === "proof") {
        if (!["preparing", "awaiting_approval", "ready"].includes(p.stage))
          fail(409, "Proofs cannot change after printing starts.");
        const line = text(v, "line_id", 100);
        if (!data.items.some((i) => i.line_id === line))
          fail(422, "Choose the exact order line.");
        const image = await db.one(
          "SELECT * FROM uploads WHERE id=? AND user_id=?",
          [text(v, "upload_id", 64), u.id],
          conn,
        );
        if (!image || !image.id.startsWith("art-"))
          fail(404, "Artwork not found.");
        await artworkMetadata(c.uploadDir, image);
        if (p.proofs.length >= 100)
          fail(422, "This order has reached its proof revision limit.");
        p.proofs.push({
          id: uid("proof-"),
          line_id: line,
          upload_id: image.id,
          sha256: digest(await readArtwork(c.uploadDir, image)),
          caption: text(v, "caption", 1000, false),
          created_at: now(),
          status: "pending",
        });
        p.stage = "awaiting_approval";
        p.checks.print_quality = false;
        p.checks.packaging = false;
      } else if (v.action === "update") {
        const next = text(v, "stage", 30);
        if (!productionStages.includes(next))
          fail(422, "Choose a production stage.");
        if (
          !v.checks ||
          typeof v.checks !== "object" ||
          Array.isArray(v.checks) ||
          productionChecks.some((k) => typeof v.checks[k] !== "boolean")
        )
          fail(422, "Please check the production checklist.");
        p.checks = Object.fromEntries(
          productionChecks.map((k) => [k, v.checks[k]]),
        );
        p.internal_notes = text(v, "internal_notes", 3000, false);
        p.customer_note = text(v, "customer_note", 1000, false);
        const at = productionStages.indexOf(p.stage),
          to = productionStages.indexOf(next);
        if (to > at + 1 && !(p.stage === "preparing" && next === "ready"))
          fail(409, "Move through production stages in order.");
        if (at >= 3 && to < at)
          fail(409, "Printed orders cannot return to proof editing.");
        assertProductionReady({ ...data, production: p }, next);
        if (["ready", "printing"].includes(next))
          for (const item of data.items)
            await verifiedProof(
              p.proofs.filter((proof) => proof.line_id === item.line_id).at(-1),
              conn,
            );
        if (["ready", "printing"].includes(next))
          for (const item of data.items) {
            if (item.upload_id) {
              const image = await db.one(
                "SELECT * FROM uploads WHERE id=?",
                [item.upload_id],
                conn,
              );
              if (!image)
                fail(
                  409,
                  "Attach a print original or customer text before production.",
                );
              await readArtwork(c.uploadDir, image);
            } else if (
              !hasText(item.design_studio, printProductFor(item.category)?.id)
            )
              fail(
                409,
                "Attach a print original or customer text before production.",
              );
          }
        p.stage = next;
      } else fail(422, "Choose a production action.");
      await audit(u, "production." + v.action, id, conn);
    } else if (route === "order-proof-response") {
      if (u?.role === "admin" && u.id !== row.user_id)
        fail(403, "Only the customer can approve this proof.");
      const proof = p.proofs.find((proof) => proof.id === v.proof_id);
      if (
        !proof ||
        p.proofs.filter((other) => other.line_id === proof.line_id).at(-1) !==
          proof ||
        proof.status !== "pending" ||
        !["preparing", "awaiting_approval", "ready"].includes(p.stage)
      )
        fail(409, "This proof is no longer awaiting a response.");
      if (!["approved", "changes_requested"].includes(v.decision))
        fail(422, "Choose a proof response.");
      if (v.decision === "approved" && v.confirm !== true)
        fail(422, "Confirm that you reviewed the final proof.");
      if (v.decision === "approved") await verifiedProof(proof, conn);
      proof.status = v.decision;
      proof.feedback = text(
        v,
        "feedback",
        1000,
        v.decision === "changes_requested",
      );
      proof.decided_at = now();
      p.stage =
        v.decision === "changes_requested" ? "preparing" : "awaiting_approval";
      if (
        v.decision === "approved" &&
        data.items.every(
          (item) =>
            p.proofs.filter((other) => other.line_id === item.line_id).at(-1)
              ?.status === "approved",
        ) &&
        ["originals", "placement", "options"].every(
          (key) => p.checks[key] === true,
        )
      )
        p.stage = "ready";
      await db.q(
        "INSERT INTO audit_log VALUES (?,?,?,?,?)",
        [uid(), u?.id || "guest", "proof." + v.decision, id, now()],
        conn,
      );
    } else fail(404, "Route not found.");
    p.revision++;
    p.history.push({
      at: now(),
      stage: p.stage,
      action: route === "admin-production" ? v.action : v.decision,
      public: true,
    });
    p.history = p.history.slice(-200);
    data.production = p;
    await db.q(
      "UPDATE orders SET data=? WHERE id=?",
      [JSON.stringify(data), row.id],
      conn,
    );
    return u?.role === "admin"
      ? order({ ...row, data: JSON.stringify(data) })
      : customerOrder({ ...row, data: JSON.stringify(data) });
  });
  return res.json({ ok: true, order: result });
}
