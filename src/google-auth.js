import {verificationStatus,markEmailVerified,verifiedEmail} from './email-verification.js';
import * as oidc from "openid-client";
import {
  fail,
  uid,
  token,
  hash,
  equal,
  email,
  text,
  now,
  json,
  verifyPassword,
} from "./security.js";

const issuer = "https://accounts.google.com";
export const hasLocalPassword = (user) =>
  !!user && !user.password.startsWith("!google-only.");
export function googleStatus(c) {
  const g = c.google || {},
    configured =
      /^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(g.clientId || "") &&
      typeof g.clientSecret === "string" &&
      g.clientSecret.length > 0 &&
      !/^(REPLACE|YOUR_)/i.test(g.clientSecret);
  return {
    enabled: g.enabled === true,
    configured,
    available: g.enabled === true && configured,
    callback_uri: c.origin + "/auth/google/callback",
  };
}
export async function authenticationStatus(c, db, user) {
  const identity = user
    ? await db.one(
        "SELECT email FROM auth_identities WHERE provider='google' AND user_id=?",
        [user.id],
      )
    : null;
  return {
    google: {
      available: googleStatus(c).available,
      linked: !!identity,
      ...(identity ? { email: identity.email } : {}),
    },
    has_password: hasLocalPassword(user),
    email: await verificationStatus(c,db,user),
  };
}
export function createGoogleProvider(c, options = {}) {
  let cached;
  const configuration = () =>
    (cached ||= (async () => {
      const config = await oidc.discovery(
        new URL(issuer),
        c.google.clientId,
        {
          client_secret: c.google.clientSecret,
          id_token_signed_response_alg: "RS256",
        },
        oidc.ClientSecretPost(c.google.clientSecret),
        {
          timeout: 10,
          ...(options.fetch ? { [oidc.customFetch]: options.fetch } : {}),
        },
      );
      oidc.enableNonRepudiationChecks(config);
      return config;
    })().catch((error) => {
      cached = null;
      throw error;
    }));
  return {
    async start(flow, state) {
      const config = await configuration();
      return oidc.buildAuthorizationUrl(config, {
        redirect_uri: googleStatus(c).callback_uri,
        scope: "openid email profile",
        response_type: "code",
        state,
        nonce: flow.nonce,
        code_challenge: await oidc.calculatePKCECodeChallenge(flow.verifier),
        code_challenge_method: "S256",
        prompt: "select_account",
        hl: flow.locale,
      }).href;
    },
    async finish(url, flow, state) {
      const config = await configuration(),
        result = await oidc.authorizationCodeGrant(config, url, {
          pkceCodeVerifier: flow.verifier,
          expectedState: state,
          expectedNonce: flow.nonce,
          idTokenExpected: true,
        }),
        claims = result.claims();
      if (
        !claims ||
        claims.email_verified !== true ||
        typeof claims.sub !== "string" ||
        !claims.sub ||
        claims.sub.length > 255 ||
        /[\u0000-\u001f]/.test(claims.sub)
      )
        fail(403, "Google could not verify this account.");
      const address = email({ email: claims.email }),
        name =
          typeof claims.name === "string"
            ? [...claims.name.replace(/[\u0000-\u001f]/g, "").trim()]
                .slice(0, 80)
                .join("")
            : "";
      // Access, refresh and ID tokens are intentionally discarded, never saved or logged.
      return {
        subject: claims.sub,
        email: address,
        name:
          Buffer.byteLength(name) <= 120
            ? name
            : [...name].slice(0, 30).join(""),
      };
    },
  };
}
function localReturn(flow, user, code) {
  const locale = flow?.locale === "ar" ? "ar" : "en",
    route =
      flow?.intent === "link" || flow?.intent === "reauth"
        ? "account"
        : ["create", "my-designs", "checkout"].includes(flow?.next)
          ? flow.next
          : user?.role === "admin"
            ? "admin"
            : user?.role === "artist"
              ? "studio"
              : "account";
  return (
    "/" + locale + "/" + route + "?" + new URLSearchParams({ google: code })
  );
}
export async function googleRoute({
  route,
  method,
  v,
  req,
  res,
  db,
  c,
  provider,
  me,
  rotate,
  throttle,
}) {
  if (method === "POST" && route === "google-start") {
    await throttle(req, "google-start", 20);
    if (!googleStatus(c).available)
      fail(503, "Google sign-in is not available yet.");
    const user = await me(req),
      intent = ["link", "reauth"].includes(v.intent) ? v.intent : "signin";
    if (intent === "signin" && user)
      fail(
        409,
        "Use account settings to connect Google to your signed-in account.",
      );
    if (intent !== "signin" && !user) fail(401, "Please sign in to continue.");
    const identity = user
      ? await db.one(
          "SELECT subject FROM auth_identities WHERE provider='google' AND user_id=?",
          [user.id],
        )
      : null;
    if (intent === "link") {
      if (identity) fail(409, "Google is already connected.");
      if (
        !hasLocalPassword(user) ||
        !(await verifyPassword(v.password, user.password))
      )
        fail(403, "Current password is incorrect.");
    }
    if (intent === "reauth" && !identity)
      fail(409, "Connect Google before using it to confirm your identity.");
    const state = token(),
      flow = {
        intent,
        locale: v.locale === "ar" ? "ar" : "en",
        role: v.role === "artist" ? "artist" : "buyer",
        next: ["create", "my-designs", "checkout"].includes(v.next)
          ? v.next
          : null,
        user_id: user?.id || null,
        password_stamp: user ? hash(user.password) : null,
        verifier: oidc.randomPKCECodeVerifier(),
        nonce: oidc.randomNonce(),
      };
    let authorization;
    try {
      authorization = await provider.start(flow, state);
    } catch {
      fail(503, "Google sign-in is temporarily unavailable. Please try again.");
    }
    await db.q("DELETE FROM oauth_states WHERE expires<?", [
      Math.floor(Date.now() / 1000),
    ]);
    await db.q("INSERT INTO oauth_states VALUES (?,?,?,?)", [
      hash(state),
      hash(req.sessionID),
      Math.floor(Date.now() / 1000) + 600,
      JSON.stringify(flow),
    ]);
    return res.json({ authorization_url: authorization });
  }
  if (method === "POST" && route === "google-disconnect") {
    const user = await me(req, true);
    await throttle(req, "google-disconnect", 8);
    if (!hasLocalPassword(user))
      fail(409, "Set a password before disconnecting Google.");
    if (!(await verifyPassword(v.password, user.password)))
      fail(403, "Current password is incorrect.");
    await db.tx(async (conn) => {
      await db.one(
        "SELECT id FROM users WHERE id=? FOR UPDATE",
        [user.id],
        conn,
      );
      if(await verifiedEmail(db,user,conn))await markEmailVerified(db,user,conn);
      await db.q(
        "DELETE FROM auth_identities WHERE provider='google' AND user_id=?",
        [user.id],
        conn,
      );
      await db.q(
        "INSERT INTO audit_log VALUES (?,?,?,?,?)",
        [uid(), user.id, "google.disconnect", user.id, now()],
        conn,
      );
    });
    await rotate(req, user);
    return res.json({ ok: true });
  }
  if (method !== "GET" || route !== "google-callback")
    fail(404, "Route not found.");
  let flow, user;
  const redirect = (code, failed = false) => {
    const locale = flow?.locale === "ar" ? "ar" : "en";
    return res.redirect(
      303,
      failed && (!flow || flow.intent === "signin")
        ? "/" + locale + "/login?" + new URLSearchParams({ google: code })
        : localReturn(flow, user, code),
    );
  };
  try {
    await throttle(req, "google-callback", 60);
    if (
      typeof req.query.state !== "string" ||
      !/^[a-f0-9]{64}$/.test(req.query.state)
    )
      return redirect("expired", true);
    const state = req.query.state;
    const record = await db.tx(async (conn) => {
      const row = await db.one(
        "SELECT * FROM oauth_states WHERE id=? FOR UPDATE",
        [hash(state)],
        conn,
      );
      if (!row || !equal(row.session_hash, hash(req.sessionID))) return null;
      await db.q("DELETE FROM oauth_states WHERE id=?", [row.id], conn);
      return Number(row.expires) > Date.now() / 1000 ? row : null;
    });
    if (!record) return redirect("expired", true);
    flow = json(record.data);
    if (!googleStatus(c).available) return redirect("unavailable", true);
    if (req.query.error)
      return redirect(
        req.query.error === "access_denied" ? "cancelled" : "failed",
        true,
      );
    if (typeof req.query.code !== "string" || req.query.code.length > 4096)
      return redirect("failed", true);
    if (flow.intent !== "signin") {
      user = await me(req, true);
      if (
        user.id !== flow.user_id ||
        !equal(hash(user.password), flow.password_stamp)
      )
        return redirect("expired", true);
    }
    const claims = await provider.finish(
      new URL(req.originalUrl, c.origin),
      flow,
      state,
    );
    let outcome;
    try {
      outcome = await db.tx(async (conn) => {
        const identity = await db.one(
          "SELECT * FROM auth_identities WHERE provider='google' AND subject=? FOR UPDATE",
          [claims.subject],
          conn,
        );
        if (flow.intent !== "signin") {
          const current = await db.one(
            "SELECT * FROM users WHERE id=? FOR UPDATE",
            [flow.user_id],
            conn,
          );
          if (
            !current ||
            current.status !== "active" ||
            !equal(hash(current.password), flow.password_stamp)
          )
            return { error: "expired" };
          if (flow.intent === "reauth") {
            if (!identity || identity.user_id !== current.id)
              return { error: "wrong_account" };
            return { user: current, reauth: true };
          }
          if (identity && identity.user_id !== current.id)
            return { error: "connected_elsewhere" };
          const linked = await db.one(
            "SELECT subject FROM auth_identities WHERE provider='google' AND user_id=?",
            [current.id],
            conn,
          );
          if (linked && linked.subject !== claims.subject)
            return { error: "connected_elsewhere" };
          const emailOwner = await db.one(
            "SELECT id FROM users WHERE email=?",
            [claims.email],
            conn,
          );
          if (emailOwner && emailOwner.id !== current.id)
            return { error: "email_exists" };
          if (!identity)
            await db.q(
              "INSERT INTO auth_identities VALUES (?,?,?,?,?,?)",
              [
                "google",
                claims.subject,
                current.id,
                claims.email,
                now(),
                now(),
              ],
              conn,
            );
          await db.q(
            "INSERT INTO audit_log VALUES (?,?,?,?,?)",
            [uid(), current.id, "google.connect", current.id, now()],
            conn,
          );
          return { user: current, linked: true };
        }
        if (identity) {
          const current = await db.one(
            "SELECT * FROM users WHERE id=? FOR UPDATE",
            [identity.user_id],
            conn,
          );
          if (!current || current.status !== "active")
            return { error: "account_unavailable" };
          return { user: current };
        }
        if (
          await db.one(
            "SELECT id FROM users WHERE email=? FOR UPDATE",
            [claims.email],
            conn,
          )
        )
          return { error: "email_exists" };
        const id = uid("user-"),
          name =
            claims.name ||
            [...claims.email.split("@")[0]].slice(0, 30).join(""),
          role = flow.role === "artist" ? "artist" : "buyer",
          created = now(),
          password = "!google-only." + token();
        await db.q(
          "INSERT INTO users VALUES (?,?,?,?,?,?,?)",
          [id, name, claims.email, password, role, "active", created],
          conn,
        );
        if (role === "artist")
          await db.q(
            "INSERT INTO artists VALUES (?,?)",
            [
              id,
              JSON.stringify({
                id,
                name,
                initials: [...name].slice(0, 2).join("").toUpperCase(),
                handle: id,
                bio: "Independent artist on Veelad.",
                location: "",
                color: "#d9d0ff",
              }),
            ],
            conn,
          );
        await db.q(
          "INSERT INTO auth_identities VALUES (?,?,?,?,?,?)",
          ["google", claims.subject, id, claims.email, created, created],
          conn,
        );
        await db.q(
          "INSERT INTO audit_log VALUES (?,?,?,?,?)",
          [uid(), id, "google.register", id, created],
          conn,
        );
        return {
          user: await db.one("SELECT * FROM users WHERE id=?", [id], conn),
        };
      });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY" || error.code === "ER_LOCK_DEADLOCK")
        return redirect("retry", true);
      throw error;
    }
    if (outcome.error) return redirect(outcome.error, true);
    user = outcome.user;
    await db.tx(async (conn) => {
      await db.one(
        "SELECT id FROM users WHERE id=? FOR UPDATE",
        [user.id],
        conn,
      );
      if(user.email.toLowerCase()===claims.email.toLowerCase())await markEmailVerified(db,user,conn);
      const old = await db.one(
          "SELECT data FROM customer_state WHERE id=?",
          [user.id],
          conn,
        ),
        data = old ? json(old.data) : { cart: [], saved: [], address: [] };
      data.user_locale = flow.locale;
      await db.q(
        "INSERT INTO customer_state VALUES (?,?) ON DUPLICATE KEY UPDATE data=VALUES(data)",
        [user.id, JSON.stringify(data)],
        conn,
      );
    });
    await rotate(req, user);
    req.session.google_authenticated_at = Date.now();
    if (flow.intent === "signin") req.session.google_login_complete = true;
    await new Promise((resolve, reject) =>
      req.session.save((error) => (error ? reject(error) : resolve())),
    );
    return redirect(
      outcome.linked ? "connected" : outcome.reauth ? "confirmed" : "signed_in",
    );
  } catch {
    console.error(
      "Google authentication failed; no provider tokens or response bodies were logged.",
    );
    return redirect("failed", true);
  }
}
