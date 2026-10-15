import {
  generateKeyPairSync,
  sign,
  createHash,
  randomBytes,
} from "node:crypto";
export const googleClientId = "veelad-fixture.apps.googleusercontent.com";
export function mockGoogle() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    }),
    codes = new Map();
  let exchanges = 0,
    discoveries = 0;
  const jwk = {
    ...publicKey.export({ format: "jwk" }),
    kid: "google-test-key",
    use: "sig",
    alg: "RS256",
  };
  const metadata = {
    issuer: "https://accounts.google.com",
    authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    token_endpoint: "https://oauth2.googleapis.com/token",
    jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    token_endpoint_auth_methods_supported: ["client_secret_post"],
    code_challenge_methods_supported: ["S256"],
  };
  const issue = (authorization, changes = {}) => {
    const url = new URL(authorization),
      code = randomBytes(20).toString("hex");
    codes.set(code, { url, changes });
    const callback = new URL(url.searchParams.get("redirect_uri"));
    callback.searchParams.set("code", code);
    callback.searchParams.set("state", url.searchParams.get("state"));
    return callback;
  };
  const fetch = async (input, init = {}) => {
    const url = String(input),
      respond = (value) =>
        new Response(JSON.stringify(value), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
    if (
      url === "https://accounts.google.com/.well-known/openid-configuration"
    ) {
      discoveries++;
      return respond(metadata);
    }
    if (url === metadata.jwks_uri) return respond({ keys: [jwk] });
    if (url !== metadata.token_endpoint) throw Error("Unexpected provider URL");
    exchanges++;
    const body = new URLSearchParams(init.body),
      entry = codes.get(body.get("code"));
    codes.delete(body.get("code"));
    if (!entry)
      return new Response(JSON.stringify({ error: "invalid_grant" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    if (
      body.get("client_id") !== googleClientId ||
      body.get("client_secret") !== "test-provider-secret-never-real" ||
      body.get("redirect_uri") !== entry.url.searchParams.get("redirect_uri") ||
      createHash("sha256")
        .update(body.get("code_verifier") || "")
        .digest("base64url") !== entry.url.searchParams.get("code_challenge")
    )
      throw Error("OAuth client, redirect URI or PKCE mismatch");
    const at = Math.floor(Date.now() / 1000),
      claims = {
        iss: metadata.issuer,
        aud: googleClientId,
        sub: "google-fixture-user",
        email: "google-fixture@example.test",
        email_verified: true,
        name: "Google Fixture",
        iat: at,
        exp: at + 3600,
        nonce: entry.url.searchParams.get("nonce"),
        ...entry.changes,
      };
    if (entry.changes.omitNonce) delete claims.nonce;
    const header = Buffer.from(
        JSON.stringify({ alg: "RS256", kid: jwk.kid, typ: "JWT" }),
      ).toString("base64url"),
      payload = Buffer.from(JSON.stringify(claims)).toString("base64url"),
      signature = sign(
        "RSA-SHA256",
        Buffer.from(header + "." + payload),
        privateKey,
      ).toString("base64url");
    const id_token =
      header +
      "." +
      payload +
      "." +
      (entry.changes.badSignature
        ? (signature[0] === "X" ? "Y" : "X") + signature.slice(1)
        : signature);
    return respond({
      token_type: "Bearer",
      access_token: "test-only-unused-access-token",
      expires_in: 3600,
      id_token,
    });
  };
  return {
    fetch,
    issue,
    get exchanges() {
      return exchanges;
    },
    get discoveries() {
      return discoveries;
    },
  };
}
