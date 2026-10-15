/* Transactional email controls. Credentials are supplied privately through hosting. */
'use strict';
function emailSystemPanel(sys) {
 const mail=sys.email;
 if(!mail) return `<p>${esc(t('Email delivery settings are unavailable.'))}</p>`;
 const deliveryStatus=mail.ready?'configured — inbox test still required':mail.enabled?'settings incomplete':'disabled';
 return `<section class="panel" style="max-width:800px;margin-top:24px"><h2 style="font-size:24px">${esc(t('Transactional email'))}</h2>
 <p>${esc(t('Email delivery:'))} <strong>${esc(t(deliveryStatus))}</strong></p>
 <p class="small">${esc(t(sys.email_verification_required?'Email verification is required for account orders and artwork submissions.':'Email verification is optional until delivery has been tested.'))}</p>
 ${mail.missing.length?`<p class="small">${esc(t('Set these in Hostinger’s private environment settings:'))} <bdi dir="ltr">${mail.missing.map(esc).join(', ')}</bdi>.</p>`:''}
 ${mail.staging_restricted?`<div class="notice">${esc(t('Staging only sends to {recipient}. Messages to other addresses stay on hold.',{recipient:mail.test_recipient||t('the inbox configured as MAIL_TEST_RECIPIENT')}))}</div>`:''}
 <p>${esc(t('Queued: {queued} · Held: {held} · Failed: {failed} · Sending: {sending} · Expired: {expired}',{queued:localNumber(sys.queued_emails),held:localNumber(sys.held_emails),failed:localNumber(sys.failed_emails),sending:localNumber(sys.sending_emails),expired:localNumber(sys.expired_emails)}))}</p>
 <p class="small">${esc(t('Held and historical messages are not sent automatically. Sending messages left after a restart need operator review. “Accepted” means the SMTP server accepted a message; check your inbox to confirm delivery.'))}</p>
 <form class="stack" data-form="admin-email"><input type="hidden" name="action" value="verify"><button class="btn outline" ${mail.ready?'':'disabled'}>${esc(t('Check SMTP connection'))}</button><div class="email-result" role="status" aria-live="polite"></div></form>
 <form class="stack" data-form="admin-email" style="margin-top:24px"><input type="hidden" name="action" value="test">
 ${field(t('Test recipient'),'email',mail.test_recipient||'','email','required maxlength="190" autocomplete="email"')}
 <label class="check"><input type="checkbox" name="confirm" required>${esc(t('I control this inbox and want to send a test email.'))}</label>
 <button class="btn" ${mail.ready?'':'disabled'}>${esc(t('Send test email'))}</button><div class="email-result" role="status" aria-live="polite"></div></form>
 </section>`;
}
