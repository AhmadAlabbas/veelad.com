import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { config } from "../src/config.js";
import { database } from "../src/db.js";
import { migrate } from "../scripts/migrate.js";
import { createApp } from "../src/app.js";
import { googleStatus } from "../src/google-auth.js";
import { mockGoogle, googleClientId } from "./helpers/google-provider.js";
import { hash, passwordHash, now } from "../src/security.js";
const pw = "A real local test password 123",
  name = "veelad_google_" + process.pid + "_test";
let db, root, c, app, server, origin, mock;
function client() {
  let cookie = "",
    csrf = "";
  return {
    get cookie() {
      return cookie;
    },
    async call(route, data, query = {}) {
      const callback = route === "google-callback",
        url =
          origin +
          (callback
            ? "/auth/google/callback?"
            : "/api.php?route=" + encodeURIComponent(route) + "&") +
          new URLSearchParams(query),
        response = await fetch(url, {
          redirect: "manual",
          method: data === undefined ? "GET" : "POST",
          headers: {
            ...(cookie ? { Cookie: cookie } : {}),
            ...(data !== undefined
              ? { "Content-Type": "application/json", "X-CSRF-Token": csrf }
              : {}),
          },
          body: data === undefined ? undefined : JSON.stringify(data),
        });
      const set = response.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0];
      const body = callback ? await response.text() : await response.json();
      if (body.csrf) csrf = body.csrf;
      return { status: response.status, body, headers: response.headers };
    },
  };
}
async function ok(client, route, data, query) {
  const r = await client.call(route, data, query);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}
async function visitor() {
  const a = client();
  await ok(a, "bootstrap");
  return a;
}
async function authorize(a, changes = {}, options = {}) {
  const start = await ok(a, "google-start", { locale: "en", ...options }),
    url = mock.issue(start.authorization_url, changes),
    result = await a.call(
      "google-callback",
      undefined,
      Object.fromEntries(url.searchParams),
    );
  return result;
}
before(async () => {
  const base = config({ ...process.env, APP_ENV: "test" });
  root = database(base);
  await root.pool.query("CREATE DATABASE ??", [name]);
  c = {
    ...base,
    google: {
      enabled: true,
      clientId: googleClientId,
      clientSecret: "test-provider-secret-never-real",
    },
    db: { ...base.db, database: name },
  };
  db = database(c);
  await migrate(db);
  const seed = JSON.parse(
    await fs.readFile(new URL("../data/seed.json", import.meta.url), "utf8"),
  );
  await db.q("INSERT INTO settings VALUES (?,?)", [
    "store",
    JSON.stringify(seed.settings),
  ]);
  mock = mockGoogle();
  app = createApp(c, db, { status: "ready" }, undefined, { fetch: mock.fetch });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  origin = "http://127.0.0.1:" + server.address().port;
  c.origin = origin;
});
beforeEach(async () => {
  await db.q("DELETE FROM rate_limits");
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (app) await app.locals.sessionStore.close();
  if (db) await db.pool.end();
  if (root) {
    await root.pool.query("DROP DATABASE IF EXISTS ??", [name]);
    await root.pool.end();
  }
});
test("Google settings fail closed without valid credentials and reveal no secret in bootstrap", async () => {
  assert.equal(
    googleStatus({ ...c, google: { enabled: true } }).available,
    false,
  );
  assert.equal(
    googleStatus({ ...c, google: { ...c.google, enabled: false } }).available,
    false,
  );
  assert.equal(googleStatus(c).available, true);
  const a = await visitor(),
    b = await ok(a, "bootstrap");
  assert.equal(b.authentication.google.available, true);
  assert.equal(b.authentication.has_password, false);
  assert.equal(JSON.stringify(b).includes(c.google.clientSecret), false);
  assert.equal(b.google_client_id, undefined);
  const blocked = await fetch(origin + "/api.php?route=google-start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(blocked.status, 403);
});
test("Google authorization is scoped, PKCE/nonce/state protected, rotates the session and cannot create administrators", async () => {
  const a = await visitor(),
    old = a.cookie,
    start = await ok(a, "google-start", {
      locale: "ar",
      role: "admin",
      next: "https://evil.example",
    }),
    url = new URL(start.authorization_url);
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("scope"), "openid email profile");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(
    url.searchParams.get("redirect_uri"),
    origin + "/auth/google/callback",
  );
  assert.equal(url.searchParams.get("hl"), "ar");
  assert.ok(url.searchParams.get("nonce"));
  assert.ok(url.searchParams.get("state"));
  const cb = mock.issue(url, {
      sub: "first-google",
      email: "first-google@example.test",
      name: "مستخدم Google",
    }),
    r = await a.call(
      "google-callback",
      undefined,
      Object.fromEntries(cb.searchParams),
    );
  assert.equal(r.status, 303);
  assert.match(r.headers.get("location"), /^\/ar\/account\?google=signed_in$/);
  assert.notEqual(a.cookie, old);
  const b = await ok(a, "bootstrap");
  assert.equal(b.user.role, "buyer");
  assert.equal(b.user.email, "first-google@example.test");
  assert.equal(b.authentication.google.linked, true);
  assert.equal(b.authentication.has_password, false);
  assert.equal(b.auth_event, "google-login");
  assert.equal((await ok(a, "bootstrap")).auth_event, null);
  assert.equal(
    (
      await a.call(
        "google-callback",
        undefined,
        Object.fromEntries(cb.searchParams),
      )
    ).headers.get("location"),
    "/en/login?google=expired",
  );
  assert.equal(mock.discoveries, 1);
});
test("wrong sessions, tampered state, expiry and provider cancellation never sign in and consume valid attempts only once", async () => {
  const a = await visitor(),
    other = await visitor(),
    start = await ok(a, "google-start", { locale: "ar" }),
    url = new URL(start.authorization_url),
    state = url.searchParams.get("state"),
    count = mock.exchanges;
  const cb = mock.issue(url, {
    sub: "session-bound",
    email: "session-bound@example.test",
  });
  assert.match(
    (
      await other.call(
        "google-callback",
        undefined,
        Object.fromEntries(cb.searchParams),
      )
    ).headers.get("location"),
    /google=expired/,
  );
  assert.equal((await ok(other, "bootstrap")).user, null);
  await db.q("UPDATE oauth_states SET expires=1 WHERE id=?", [hash(state)]);
  assert.match(
    (
      await a.call(
        "google-callback",
        undefined,
        Object.fromEntries(cb.searchParams),
      )
    ).headers.get("location"),
    /google=expired/,
  );
  assert.equal(mock.exchanges, count);
  const fresh = await ok(a, "google-start", { locale: "ar" }),
    freshUrl = new URL(fresh.authorization_url);
  const denied = await a.call("google-callback", undefined, {
    state: freshUrl.searchParams.get("state"),
    error: "access_denied",
    error_description: "private-untrusted-error",
  });
  assert.equal(denied.headers.get("location"), "/ar/login?google=cancelled");
  assert.equal(denied.body.includes("private-untrusted-error"), false);
  assert.equal((await ok(a, "bootstrap")).user, null);
});
test("invalid token signatures, issuer, audience, expiry, nonce and unverified emails are rejected", async () => {
  for (const changes of [
    { badSignature: true },
    { iss: "https://evil.example" },
    { aud: "other-client" },
    { exp: 1 },
    { nonce: "wrong-nonce" },
    { omitNonce: true },
    { email_verified: false },
  ]) {
    const a = await visitor(),
      r = await authorize(a, changes);
    assert.match(r.headers.get("location"), /google=failed/);
    assert.equal((await ok(a, "bootstrap")).user, null);
  }
});
test("a password account with a matching email is never silently linked or promoted", async () => {
  const a = await visitor();
  await ok(a, "register", {
    name: "Existing owner",
    email: "existing-google@example.test",
    password: pw,
    role: "artist",
  });
  const id = (await ok(a, "bootstrap")).user.id;
  await ok(a, "logout", {});
  const r = await authorize(a, {
    sub: "existing-sub",
    email: "existing-google@example.test",
  });
  assert.match(r.headers.get("location"), /google=email_exists/);
  assert.equal((await ok(a, "bootstrap")).user, null);
  assert.equal(
    await db.one("SELECT user_id FROM auth_identities WHERE user_id=?", [id]),
    null,
  );
  await ok(a, "login", { email: "existing-google@example.test", password: pw });
  assert.equal(
    (await a.call("google-start", { intent: "link", password: "wrong" }))
      .status,
    403,
  );
  const linked = await authorize(
    a,
    { sub: "existing-sub", email: "existing-google@example.test" },
    { intent: "link", password: pw, locale: "ar" },
  );
  assert.equal(linked.headers.get("location"), "/ar/account?google=connected");
  assert.equal((await ok(a, "bootstrap")).user.role, "artist");
  await ok(a, "logout", {});
  await authorize(
    a,
    { sub: "existing-sub", email: "changed-google-email@example.test" },
    { role: "buyer" },
  );
  const signed = await ok(a, "bootstrap");
  assert.equal(signed.user.id, id);
  assert.equal(signed.user.role, "artist");
  assert.equal(signed.user.email, "existing-google@example.test");
});
test("new artist Google accounts get a studio, existing suspended accounts stay unavailable", async () => {
  const a = await visitor();
  await authorize(
    a,
    { sub: "google-artist", email: "google-artist@example.test" },
    { role: "artist" },
  );
  const u = (await ok(a, "bootstrap")).user;
  assert.equal(u.role, "artist");
  assert.ok(await db.one("SELECT id FROM artists WHERE id=?", [u.id]));
  await db.q("UPDATE users SET status='suspended' WHERE id=?", [u.id]);
  await ok(a, "logout", {});
  const r = await authorize(a, {
    sub: "google-artist",
    email: "google-artist@example.test",
  });
  assert.match(r.headers.get("location"), /google=account_unavailable/);
  assert.equal((await ok(a, "bootstrap")).user, null);
});
test("Google-only users can set a password after recent authentication, then disconnect without losing their account", async () => {
  const a = await visitor();
  await authorize(a, {
    sub: "google-password",
    email: "google-password@example.test",
  });
  const id = (await ok(a, "bootstrap")).user.id;
  assert.equal(
    (await a.call("google-disconnect", { password: pw })).status,
    409,
  );
  const activeSession=await db.one('SELECT session_id,data FROM sessions WHERE data LIKE ?',['%'+id+'%']),sessionData=JSON.parse(activeSession.data);sessionData.google_authenticated_at=Date.now()-360000;
  await db.q('UPDATE sessions SET data=? WHERE session_id=?',[JSON.stringify(sessionData),activeSession.session_id]);
  assert.equal((await a.call('password',{password:pw})).status,403);
  await authorize(a,{sub:'google-password',email:'google-password@example.test'},{intent:'reauth'});
  await ok(a, "password", { password: pw });
  assert.equal((await ok(a, "bootstrap")).authentication.has_password, true);
  assert.equal(
    (await a.call("google-disconnect", { password: "wrong" })).status,
    403,
  );
  await ok(a, "google-disconnect", { password: pw });
  assert.equal((await ok(a, "bootstrap")).authentication.google.linked, false);
  assert.equal((await ok(a, "bootstrap")).authentication.email.verified, true);
  await ok(a, "logout", {});
  await ok(a, "login", { email: "google-password@example.test", password: pw });
  assert.equal((await ok(a, "bootstrap")).user.id, id);
});
test("linking refuses a Google identity connected elsewhere; reauthentication must use the linked subject", async () => {
  const a = await visitor();
  await ok(a, "register", {
    name: "Another owner",
    email: "another-owner@example.test",
    password: pw,
  });
  const bad = await authorize(
    a,
    { sub: "existing-sub", email: "existing-google@example.test" },
    { intent: "link", password: pw },
  );
  assert.match(bad.headers.get("location"), /google=connected_elsewhere/);
  assert.equal((await ok(a, "bootstrap")).authentication.google.linked, false);
  const b = await visitor();
  await authorize(b, {
    sub: "google-reauth",
    email: "google-reauth@example.test",
  });
  const wrong = await authorize(
    b,
    { sub: "wrong-google", email: "wrong-google@example.test" },
    { intent: "reauth" },
  );
  assert.match(wrong.headers.get("location"), /google=wrong_account/);
  const right = await authorize(
    b,
    { sub: "google-reauth", email: "google-reauth@example.test" },
    { intent: "reauth" },
  );
  assert.match(right.headers.get("location"), /google=confirmed/);
});

test("concurrent callbacks consume one authorization attempt and perform only one token exchange", async () => {
  const a = await visitor(),
    start = await ok(a, "google-start", {}),
    url = mock.issue(start.authorization_url, {
      sub: "concurrent-google",
      email: "concurrent-google@example.test",
    }),
    before = mock.exchanges,
    query = Object.fromEntries(url.searchParams);
  const results = await Promise.all([
    a.call("google-callback", undefined, query),
    a.call("google-callback", undefined, query),
  ]);
  assert.equal(mock.exchanges, before + 1);
  assert.equal(
    results.filter((r) => r.headers.get("location").includes("signed_in"))
      .length,
    1,
  );
  assert.equal(
    results.filter((r) => r.headers.get("location").includes("expired")).length,
    1,
  );
});
