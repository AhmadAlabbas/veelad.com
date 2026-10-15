/* Account email confirmation. Opening a link never consumes it automatically. */
'use strict';
let verificationToken='',recoveryToken='',verificationComplete=false,verificationResendAt=0;
function captureAccountEmailLink(){
 const page=location.pathname.match(/\/(verify-email|reset)\/?$/)?.[1];
 if(!page)return false;
 const fragment=new URLSearchParams(location.hash.slice(1)),query=new URLSearchParams(location.search);
 if(!fragment.has('token')&&!query.has('token'))return false;
 const value=fragment.get('token')||query.get('token')||'';
 if(page==='verify-email'){verificationToken=value;verificationComplete=false;}
 else recoveryToken=value;
 query.delete('token');const search=query.toString();
 history.replaceState(null,'',location.pathname+(search?'?'+search:''));
 return true;
}
captureAccountEmailLink();
window.addEventListener('hashchange',()=>{if(captureAccountEmailLink())render();});
function emailVerificationPanel(){
 if(mode!=='server'||!user)return '';
 const status=authentication.email||{},waiting=Date.now()-verificationResendAt<60000;
 return `<section class="panel bottom-gap email-verification" aria-labelledby="email-verification-heading"><h3 id="email-verification-heading">${t('Email verification')}</h3><p><bdi>${esc(user.email)}</bdi> · <strong>${t(status.verified?'Verified':'Not verified yet')}</strong></p>${status.verified?`<p class="small">${t('Your account email address is verified.')}</p>`:`<p>${t('Confirm your email to protect your account and receive account updates.')}</p>${status.required?`<p class="small">${t('Verify your email before placing an order or submitting artwork. You can still browse and save drafts.')}</p>`:''}${status.delivery_available?`<form data-form="resend-verification" class="stack"><button type="submit" class="btn outline" ${waiting?'disabled':''}>${t('Resend verification email')}</button><p class="small" role="status">${waiting?t('Verification email queued. Check your inbox and spam folder.'):t('Verification links expire after one hour.')}</p></form>`:`<p class="notice">${t('Email verification delivery is unavailable for this address.')}</p>`}`}</section>`;
}
function emailVerificationPage(){
 return `<main id="main" class="center-page"><h1>${t(verificationComplete?'Email verified.':'Verify your email.')}</h1>${verificationComplete?`<p role="status">${t('Your account email address is verified.')}</p>${link(t(user?'Go to my account':'Back to sign in'),user?'account':'login','btn')}`:verificationToken?`<p>${t('Press the button below to confirm the email address associated with this link.')}</p><form data-form="verify-email" class="stack"><button type="submit" class="btn">${t('Confirm email address')}</button></form>`:`<p>${t('Open the verification link from your email. Links expire after one hour and can only be used once.')}</p>${user?emailVerificationPanel():link(t('Sign in to request another link'),'login','btn')}`}</main>`;
}
