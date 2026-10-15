"use strict";
const googleMessages = {
  cancelled:
    "Google sign-in was cancelled. You can try again or use your password.",
  expired: "Your Google sign-in request expired. Please start again.",
  unavailable: "Google sign-in is not available yet.",
  failed: "Google sign-in could not be completed. Please try again.",
  retry: "Your account changed during sign-in. Please try Google again.",
  email_exists:
    "This email already has a Veelad account. Sign in with your existing password, then connect Google in your account settings.",
  connected_elsewhere:
    "This Google account is already connected to another Veelad account.",
  wrong_account:
    "Choose the Google account already connected to your Veelad account.",
  account_unavailable: "This account is unavailable. Contact the store team.",
  connected: "Google is now connected to your account.",
  confirmed: "Your identity was confirmed. You can set a password now.",
  signed_in: "You are signed in with Google.",
};
function googleAuthNotice() {
  const message = googleMessages[params.get("google")];
  return message
    ? `<p class="notice ${["connected", "confirmed", "signed_in"].includes(params.get("google")) ? "" : "error"}" role="status">${esc(t(message))}</p>`
    : "";
}
function googleLogo() {
  return '<svg class="google-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.02 46.98 31.87 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.78 24c0-1.59.27-3.13.75-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>';
}
function googleSigninControls() {
  return mode === "server" && authentication.google?.available
    ? `<div class="google-signin"><button type="button" class="google-button" data-action="google-signin">${googleLogo()}<span>${t("Continue with Google")}</span></button><div class="auth-divider"><span>${t("Or use your email")}</span></div></div>`
    : "";
}
function googleAccountSettings() {
  if (mode !== "server") return "";
  const g = authentication.google || {};
  return `<section class="panel google-account bottom-gap"><h3>${t("Sign-in methods")}</h3>${googleAuthNotice()}${g.linked ? `<p>${t("Google connected")} · <bdi>${esc(g.email)}</bdi></p><p class="small">${t("Your Google connection does not change your Veelad email address.")}</p>${authentication.has_password ? `<form data-google-form="disconnect" class="stack"><label class="field">${t("Current password")}<input name="password" type="password" required maxlength="128" autocomplete="current-password"></label><button class="btn outline">${t("Disconnect Google")}</button></form>` : `<p class="small">${t("Set a password before disconnecting Google.")}</p>`}` : g.available ? `<p>${t("Connect Google to sign in to this same account without entering your password next time.")}</p><form data-google-form="link" class="stack"><label class="field">${t("Current password")}<input name="password" type="password" required maxlength="128" autocomplete="current-password"></label><button class="google-button">${googleLogo()}<span>${t("Connect Google")}</span></button></form>` : `<p class="small">${t("Google sign-in is not available yet.")}</p>`}</section>`;
}
function googleOnlyPasswordForm() {
  return `<details class="google-set-password"><summary>${t("Set a password")}</summary><p class="small">${t("A recent Google sign-in is required. This gives you another way to access your account.")}</p>${authentication.google?.available ? `<button type="button" class="google-button" data-action="google-reauth">${googleLogo()}<span>${t("Confirm identity with Google")}</span></button>` : ""}<form data-form="password" class="stack"><label class="field">${t("New password")}<input type="password" name="password" required minlength="12" maxlength="128" autocomplete="new-password"></label><button class="btn">${t("Set password")}</button></form></details>`;
}
function googleSystemPanel(status) {
  if (!status) return "";
  return `<section class="panel google-system"><h3>${t("Google sign-in")}</h3><p>${t(status.available ? "Google sign-in is enabled." : status.enabled ? "Google credentials are incomplete." : "Google sign-in is disabled.")}</p><p class="small">${t("Configure a Google Web application OAuth client privately in Hostinger. No mailbox password or SMTP is needed.")}</p><dl><dt>${t("Authorized redirect URI")}</dt><dd><code dir="ltr">${esc(status.callback_uri)}</code></dd></dl><p><code>GOOGLE_AUTH_ENABLED</code> · <code>GOOGLE_CLIENT_ID</code> · <code>GOOGLE_CLIENT_SECRET</code></p><p class="small">${t("Use separate Google clients and secrets for staging and production. Never put the client secret in GitHub or chat.")}</p></section>`;
}
async function beginGoogle(control, intent = "signin", password = "") {
  const form = control.closest("form");
  if (control.disabled) return;
  control.disabled = true;
  form?.querySelector(".google-error")?.remove();
  try {
    if (typeof flushCustomerDraft === "function") await flushCustomerDraft();
    await stateQueue;
    const result = await api("google-start", {
      intent,
      password,
      locale: currentLanguage(),
      role:
        document.querySelector("[data-form=register] [name=role]")?.value ||
        "buyer",
      next: params.get("next") || null,
    });
    const destination = new URL(result.authorization_url);
    if (
      destination.protocol !== "https:" ||
      destination.hostname !== "accounts.google.com"
    )
      throw Error("Google sign-in could not be completed. Please try again.");
    location.assign(destination.href);
  } catch (error) {
    const node = document.createElement("p");
    node.className = "notice error google-error";
    node.setAttribute("role", "alert");
    node.textContent = localizedError(error.message);
    (form || control.parentElement).append(node);
    control.disabled = false;
  }
}
document.addEventListener("click", async (event) => {
  const control = event.target.closest(
    "[data-action=google-signin],[data-action=google-reauth]",
  );
  if (!control) return;
  event.preventDefault();
  await beginGoogle(
    control,
    control.dataset.action === "google-reauth" ? "reauth" : "signin",
  );
});
document.addEventListener("submit", async (event) => {
  const form = event.target,
    intent = form.dataset.googleForm;
  if (!intent) return;
  event.preventDefault();
  if (!form.reportValidity() || form.dataset.saving) return;
  form.dataset.saving = "true";
  const control = event.submitter || form.querySelector("button");
  try {
    if (intent === "link")
      await beginGoogle(control, "link", form.elements.password.value);
    else {
      control.disabled = true;
      await api("google-disconnect", {
        password: form.elements.password.value,
      });
      await refreshData();
      await render();
      toast(t("Google was disconnected. Your password still works."));
    }
  } catch (error) {
    const node = document.createElement("p");
    node.className = "notice error";
    node.setAttribute("role", "alert");
    node.textContent = localizedError(error.message);
    form.append(node);
  } finally {
    delete form.dataset.saving;
    control.disabled = false;
  }
});
