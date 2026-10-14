/* Transactional email controls. Credentials are supplied privately through hosting. */
'use strict';
function emailSystemPanel(sys) {
 const mail=sys.email;
 if(!mail) return '<p>Email delivery settings are unavailable.</p>';
 return `<section class="panel" style="max-width:800px;margin-top:24px"><h2 style="font-size:24px">Transactional email</h2>
 <p>Email delivery: <strong>${mail.ready?'configured — inbox test still required':mail.enabled?'settings incomplete':'disabled'}</strong></p>
 ${mail.missing.length?`<p class="small">Set these in Hostinger’s private environment settings: ${mail.missing.map(esc).join(', ')}.</p>`:''}
 ${mail.staging_restricted?`<div class="notice">Staging only sends to ${mail.test_recipient?esc(mail.test_recipient):'the inbox configured as MAIL_TEST_RECIPIENT'}. Messages to other addresses stay on hold.</div>`:''}
 <p>Queued: ${sys.queued_emails} · Held: ${sys.held_emails} · Failed: ${sys.failed_emails} · Sending: ${sys.sending_emails} · Expired: ${sys.expired_emails}</p>
 <p class="small">Held and historical messages are not sent automatically. Sending messages left after a restart need operator review. “Accepted” means the SMTP server accepted a message; check your inbox to confirm delivery.</p>
 <form class="stack" data-form="admin-email"><input type="hidden" name="action" value="verify"><button class="btn outline" ${mail.ready?'':'disabled'}>Check SMTP connection</button><div class="email-result" role="status" aria-live="polite"></div></form>
 <form class="stack" data-form="admin-email" style="margin-top:24px"><input type="hidden" name="action" value="test">
 ${field('Test recipient','email',mail.test_recipient||'','email','required maxlength="190" autocomplete="email"')}
 <label class="check"><input type="checkbox" name="confirm" required>I control this inbox and want to send a test email.</label>
 <button class="btn" ${mail.ready?'':'disabled'}>Send test email</button><div class="email-result" role="status" aria-live="polite"></div></form>
 </section>`;
}
