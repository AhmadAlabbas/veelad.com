import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { config } from "../../src/config.js";
import { database } from "../../src/db.js";
import { migrate } from "../../scripts/migrate.js";
import { createApp } from "../../src/app.js";
import { mockGoogle, googleClientId } from "./google-provider.js";
export async function googleApp(overrides = {}) {
  const base = config();
  if (base.mode !== "local" || base.db.database !== "veelad_local")
    throw Error("Google browser fixtures require isolated local configuration");
  const name =
      "veelad_google_browser_" +
      process.pid +
      "_" +
      randomBytes(3).toString("hex") +
      "_test",
    root = database(base);
  await root.pool.query("CREATE DATABASE ??", [name]);
  const c = {
      ...base,
      ...overrides,
      mode: "test",
      google: {
        enabled: true,
        clientId: googleClientId,
        clientSecret: "test-provider-secret-never-real",
      },
      db: { ...base.db, database: name },
    },
    db = database(c);
  await migrate(db);
  const seed = JSON.parse(
    await fs.readFile(new URL("../../data/seed.json", import.meta.url), "utf8"),
  );
  await db.q("INSERT INTO settings VALUES (?,?)", [
    "store",
    JSON.stringify(seed.settings),
  ]);
  for (const a of seed.artists)
    await db.q("INSERT INTO artists VALUES (?,?)", [a.id, JSON.stringify(a)]);
  for (const p of seed.products)
    await db.q("INSERT INTO products VALUES (?,?,?,?,?,?)", [
      p.id,
      p.artist_id,
      "active",
      p.stock,
      JSON.stringify(p),
      new Date().toISOString(),
    ]);
  const provider = mockGoogle(),
    app = createApp(c, db, { status: "ready" }, undefined, {
      fetch: provider.fetch,
    }),
    server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  c.origin = "http://127.0.0.1:" + server.address().port;
  return {
    config: c,
    db,
    origin: c.origin,
    provider,
    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await app.locals.sessionStore.close();
      await db.pool.end();
      await root.pool.query("DROP DATABASE IF EXISTS ??", [name]);
      await root.pool.end();
    },
  };
}
