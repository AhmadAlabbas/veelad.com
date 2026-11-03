(() => {
'use strict';
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const roles=['viewer','operator','qc','manager'];
const roleTitle={viewer:'Viewer · status only',operator:'Operator · print and pack',qc:'QC reviewer · approve quality',manager:'Manager · resolve issues'};
const categories=['T-shirts','Tote bags','Phone cases','Art prints','Mugs','Stickers','Notebooks'];
const format=date=>date?new Date(date).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
const selectRole=(selected='operator')=>roles.map(role=>'<option value="'+role+'" '+(role===selected?'selected':'')+'>'+esc(roleTitle[role])+'</option>').join('');
const tokens=new URL(location.href).hash.match(/^#invite=([a-f0-9]{64})$/i);
const memory={supplier:null,people:[],invites:[],specs:[],invitationLink:null,pendingInvite:tokens?.[1]||null,extras:null,session:null};
if(memory.pendingInvite)history.replaceState({},'',location.pathname+location.search);
let sdk;
const api=(route,opts)=>sdk.api(route,opts);
const jobId=()=>memory.extras?.jobId||null;
function allowed(role,action){
 if(role==='admin'||role==='manager')return true;
 const rules={viewer:['view','qc-view'],operator:['view','file','accept','printing','hold','issue','photo','packed','dispatch','qc-view'],
  qc:['view','file','hold','issue','photo','quality_check','qc-review','qc-view']};
 return rules[role]?.includes(action)||false;
}
async function loadTeam(){
 if(!memory.supplier)return;
 const id=memory.supplier;
 const [people,invites,specs]=await Promise.all([
  api('admin-fulfillment-members',{params:{supplier_id:id}}),
  api('admin-fulfillment-invites',{params:{supplier_id:id}}),
  api('admin-fulfillment-specs',{params:{supplier_id:id}})
 ]);
 memory.people=people.members||[];memory.invites=invites.invitations||[];memory.specs=specs.specs||[];
}
async function bootstrap(session){
 memory.session=session;memory.extras=null;
 if(!session?.admin||!session?.mfa?.verified)return;
 const suppliers=session.suppliers.filter(s=>s.status==='active');
 if(!suppliers.some(s=>s.id===memory.supplier))memory.supplier=suppliers[0]?.id||null;
 if(memory.supplier)await loadTeam();
}
async function loadJob(d){
 memory.extras={jobId:d.job.id,pack:null,qc:null,issues:null,error:null};
 try{
  const [pack,qc,issues]=await Promise.all([
   api('fulfillment-pack-preflight',{params:{order_id:d.job.id}}),
   api('fulfillment-qc-evidence',{params:{order_id:d.job.id}}),
   api('fulfillment-issues',{params:{order_id:d.job.id}})
  ]);
  memory.extras={jobId:d.job.id,pack,qc,issues};
 }catch(error){memory.extras.error=error.message;}
}
function inviteBanner(session){
 if(!memory.pendingInvite)return '';
 return '<section class="card phase1-invite-banner"><div class="card-title"><h2>Supplier invitation</h2></div>'+
 '<p class="section-subtitle">This is a one-time, 48-hour invitation. Sign in with the invited email, verify your account email, and unlock your authenticator to accept it. Do not forward the link.</p>'+
 (session?.mfa?.verified?'<button type="button" class="button accent" data-p1="accept-invite">Accept supplier invitation</button>':
 '<p class="hint">Sign in or complete authenticator setup first, then use this invitation in the same open tab.</p>')+'</section>';
}
function supplierPanel(session){
 if(!session?.admin)return '';
 const companies=session.suppliers.filter(s=>s.status==='active');
 if(!companies.length)return '<section class="card">'+
 '<h2>Supplier onboarding</h2><p class="section-subtitle">Create Merchlist above to enable employee invitations and confirmed print specifications.</p></section>';
 const people=memory.people||[],invites=memory.invites||[],specs=memory.specs||[];
 const controls='<div class="field"><label for="p1-company">Manage supplier company</label><select id="p1-company">'+companies.map(x=>'<option value="'+esc(x.id)+'" '+(memory.supplier===x.id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></div>';
 const inviteForm='<form data-form="p1-invite"><div class="form-row"><div class="field"><label for="p1-email">Employee email</label><input type="email" name="email" id="p1-email" placeholder="production@company.com" maxlength="190" required autocomplete="off"></div>'+
 '<div class="field"><label for="p1-role">Permission level</label><select name="role" id="p1-role">'+selectRole()+'</select></div></div><button class="button accent" type="submit">Create 48-hour invitation</button></form>';
 const last=memory.invitationLink?'<div class="hint" style="margin-top:14px"><strong>One-time invitation link</strong><p>Share this private link securely with the named employee. It is displayed only now.</p>'+
 '<div class="form-row"><input id="p1-invite-link" readonly value="'+esc(memory.invitationLink)+'"><button class="button secondary" type="button" data-p1="copy-invite">Copy link</button></div></div>':'';
 const inviteRows=invites.length?'<div class="table-scroll"><table class="data-table"><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Expires</th><th></th></tr></thead><tbody>'+
 invites.map(x=>'<tr><td>'+esc(x.email)+'</td><td>'+esc(x.role)+'</td><td>'+esc(x.status)+'</td><td>'+format(Number(x.expires)*1000)+'</td><td>'+
 (x.status==='pending'?'<button data-p1="revoke" data-invite-id="'+esc(x.id)+'">Revoke</button>':'')+'</td></tr>').join('')+'</tbody></table></div>':
 '<p class="form-help">No invitations have been issued.</p>';
 const personRows=people.length?'<div class="table-scroll"><table class="data-table"><thead><tr><th>Employee</th><th>Access</th><th>Role</th><th></th></tr></thead><tbody>'+
 people.map(x=>'<tr><td>'+esc(x.name)+'<br><span class="secondary-text">'+esc(x.email)+'</span></td><td>'+esc(x.access)+'</td><td>'+
 (x.access==='active'?'<select aria-label="Role for '+esc(x.name)+'" id="p1-role-'+esc(x.user_id)+'">'+selectRole(x.role)+'</select>':esc(x.role))+'</td><td>'+
 (x.access==='active'?'<button data-p1="role" data-user-id="'+esc(x.user_id)+'">Save role</button>':'')+'</td></tr>').join('')+'</tbody></table></div>':
 '<p class="form-help">No linked employees yet.</p>';
 const specRows=specs.length?'<div class="table-scroll"><table class="data-table"><thead><tr><th>Category</th><th>Print area</th><th>Pixels target</th><th>Revision</th></tr></thead><tbody>'+
 specs.map(x=>'<tr><td>'+esc(x.category)+'</td><td>'+Number(x.print_width_mm)+' × '+Number(x.print_height_mm)+' mm · '+Number(x.bleed_mm)+' mm bleed</td><td>'+Number(x.target_dpi)+' DPI</td><td>'+Number(x.revision)+'</td></tr>').join('')+'</tbody></table></div>':'<p class="form-help">No factory print sizes have been confirmed yet. Orders cannot be released to printing until the dimensions are approved.</p>';
 const specForm='<form data-form="p1-spec"><div class="form-row"><div class="field"><label for="p1-category">Garment / product</label><select name="category" id="p1-category">'+categories.map(c=>'<option>'+esc(c)+'</option>').join('')+'</select></div>'+
 '<div class="field"><label for="p1-dpi">Required resolution (DPI)</label><input id="p1-dpi" type="number" name="target_dpi" min="150" max="600" value="300" required></div></div>'+
 '<div class="form-row"><div class="field"><label>Maximum print width (mm)</label><input name="print_width_mm" type="number" min="10" max="800" placeholder="Factory specification" required></div>'+
 '<div class="field"><label>Maximum print height (mm)</label><input name="print_height_mm" type="number" min="10" max="800" placeholder="Factory specification" required></div></div>'+
 '<div class="field"><label>Print bleed (mm)</label><input name="bleed_mm" type="number" min="0" max="20" value="0" required></div>'+
 '<label class="p1-check"><input type="checkbox" name="approved" required> I have confirmed these dimensions and resolution with this manufacturing supplier.</label>'+
 '<button type="submit" class="button accent">Save confirmed print specification</button></form>';
 return '<section class="card"><div class="card-title"><h2>Phase 1 · Supplier permissions</h2></div>'+controls+
 '<div class="two-col"><div><h3>Invite supplier employees</h3><p class="section-subtitle">Each employee must use an individual verified Veelad account and an authenticator. No shared credentials.</p>'+
 inviteForm+last+'</div><div><h3>Supplier account security</h3><p class="section-subtitle">Invitation links expire after 48 hours and cannot be reused. Viewer, operator, QC reviewer and manager roles are checked on the server.</p>'+
 '<div class="hint">For staging, if supplier email delivery is disabled, use Copy link and share it through a verified private channel.</div></div></div>'+
 '<h3 style="margin-top:26px">Pending and previous invitations</h3>'+inviteRows+
 '<h3 style="margin-top:26px">Current team & roles</h3>'+personRows+'</section>'+
 '<section class="card"><div class="card-title"><h2>Factory-approved print specifications</h2></div>'+
 '<p class="section-subtitle">Enter only measurements confirmed with Merchlist. The portal deliberately has no invented default printing dimensions. Updating a specification invalidates old print-pack approvals.</p>'+
 '<div class="two-col"><div>'+specForm+'</div><div>'+specRows+'</div></div></section>';
}
function orderPanel(d){
 const ex=memory.extras;
 if(!ex||ex.jobId!==d.job.id)return '<section class="card"><div class="loading-panel">Loading production preflight and quality evidence…</div></section>';
 if(ex.error)return '<section class="card"><h2>Phase 1 verification</h2><p class="notice error">'+esc(ex.error)+'</p></section>';
 const role=d.staff_role||'viewer',pack=ex.pack||{},qc=ex.qc||{},issues=ex.issues?.issues||[];
 const lines=(pack.lines||[]).map(x=>'<div class="item-card"><div class="status-line"><strong>'+esc(x.title)+' · '+esc(x.line_id)+'</strong>'+
 '<span class="status '+(x.passed?'packed':'on_hold')+'">'+(x.passed?'Preflight passed':'Needs attention')+'</span></div>'+
 '<p class="item-meta">'+esc(x.category)+' · '+esc(x.variant)+' · '+Number(x.qty||0)+' units</p>'+
 (x.supplier_spec?'<div class="pill-note">Confirmed print area: '+Number(x.supplier_spec.width_mm)+' × '+Number(x.supplier_spec.height_mm)+' mm · '+
 Number(x.supplier_spec.dpi)+' DPI · '+Number(x.supplier_spec.bleed_mm)+' mm bleed</div>':'')+
 (x.sources||[]).map(s=>'<p class="form-help">Original '+esc(s.id)+' · '+(s.actual_pixels?Number(s.actual_pixels.width)+' × '+Number(s.actual_pixels.height)+' px':'missing')+
 ' · min '+Number(s.minimum_pixels.width)+' × '+Number(s.minimum_pixels.height)+' px · '+esc(s.reason)+'</p>').join('')+
 (x.warning?'<p class="p1-warning">'+esc(x.warning)+'</p>':'')+'</div>').join('');
 const actions=(d.job.status==='assigned'||d.job.status==='accepted')&&d.staff_role==='admin'&&pack.passed&&!pack.approved?
 '<form data-form="p1-pack-approve"><div class="field"><label for="p1-approve-note">Production approval note</label><input id="p1-approve-note" name="note" maxlength="500" placeholder="Supplier print area, materials and source files reviewed"></div>'+
 '<button class="button accent" type="submit">Approve supplier print pack</button></form>':'';
 const download=pack.approved&&allowed(role,'file')?'<a class="button accent" href="'+esc(sdk.urlFor('fulfillment-pack-download',{order_id:d.job.id}))+'" download>Download approved ZIP production pack ↓</a>':'';
 const approvalText=pack.approved?'<div class="hint"><strong>Approved by Veelad</strong> · '+esc(format(pack.approval?.approved_at))+'</div>':
 '<div class="hint">Printing is blocked until every source meets the confirmed factory specification and Veelad approves the pack.</div>';
 const packagePanel='<section class="card"><div class="card-title"><div><h2>Verified production pack</h2><p>Factory-specific print area, original resolution and approved order snapshot</p></div>'+
 '<span class="status '+(pack.approved?'packed':'on_hold')+'">'+(pack.approved?'Approved':'Not approved')+'</span></div>'+approvalText+
 '<div style="margin:18px 0">'+(lines||'<p>No available print preflight.</p>')+'</div><div class="actions">'+download+actions+'</div></section>';
 const photos=(qc.photos||[]).map(p=>'<figure class="p1-photo"><img loading="lazy" alt="QC inspection for '+esc(p.line_id)+'" src="'+esc(sdk.urlFor('fulfillment-qc-photo',{order_id:d.job.id,evidence_id:p.id}))+'"><figcaption>'+esc(p.line_id)+' · '+esc(p.note||'QC photo')+'<br>'+esc(format(p.created_at))+'</figcaption></figure>').join('');
 const canUpload=allowed(role,'photo')&&['printing','quality_check','on_hold'].includes(d.job.status);
 const photoForm=canUpload?'<form data-form="p1-photo" enctype="multipart/form-data"><div class="field"><label for="p1-line">Order line</label><select name="line_id" id="p1-line">'+d.items.map(l=>'<option value="'+esc(l.line_id)+'">'+esc(l.title)+' · '+esc(l.line_id)+'</option>').join('')+'</select></div>'+
 '<div class="field"><label for="p1-photo-file">Photo of the actual printed item (PNG/JPEG, max 8 MB)</label><input id="p1-photo-file" type="file" accept="image/png,image/jpeg" name="photo" required></div>'+
 '<div class="field"><label for="p1-photo-note">Inspection notes</label><input name="note" maxlength="500" placeholder="Print placement, colour and any visible defects"></div><button type="submit" class="button accent">Upload private QC photo</button></form>':'';
 const reviewForm=d.job.status==='printing'&&allowed(role,'qc-review')?'<form data-form="p1-qc-review">'+
 '<label class="p1-check"><input type="checkbox" name="placement" required> All placement and alignment checks passed</label>'+
 '<label class="p1-check"><input type="checkbox" name="colour" required> All printed colours match the approved artwork</label>'+
 '<label class="p1-check"><input type="checkbox" name="finish" required> Finish, defects and final garment condition verified</label>'+
 '<button type="submit" class="button accent">Sign off quality control</button></form>':'';
 const qcPanel='<section class="card"><div class="card-title"><div><h2>Photo-based quality control</h2><p>At least one photo per purchased order line, plus a designated QC reviewer</p></div>'+
 '<span class="status '+(qc.review?.reviewed_by?'packed':'on_hold')+'">'+(qc.review?.reviewed_by?'Signed off':'Awaiting review')+'</span></div>'+
 '<div class="p1-photos">'+(photos||'<p class="section-subtitle">No photos uploaded yet.</p>')+'</div>'+
 (qc.review?.reviewed_by?'<div class="hint">Reviewed by '+esc(qc.review.reviewed_by)+' on '+esc(format(qc.review.reviewed_at))+'</div>':'')+
 photoForm+reviewForm+'</section>';
 const open=issues.filter(x=>x.status==='open'),canIssue=allowed(role,'issue'),canResolve=allowed(role,'resolve');
 const issuesHTML=issues.length?issues.map(x=>'<div class="item-card"><div class="status-line"><strong>'+esc(x.kind)+' · '+esc(x.severity)+'</strong><span class="status '+(x.status==='open'?'on_hold':'packed')+'">'+esc(x.status)+'</span></div>'+
 '<p class="section-subtitle">'+esc(x.message)+'</p>'+(x.resolution?'<div class="hint">Resolution: '+esc(x.resolution)+'</div>':'')+
 (x.status==='open'&&canResolve?'<button class="button secondary" type="button" data-p1="resolve-issue" data-issue-id="'+esc(x.id)+'">Resolve issue</button>':'')+'</div>').join(''):'<p class="section-subtitle">No reported production issues.</p>';
 const issueForm=canIssue&&d.job.status!=='dispatch_submitted'?'<form data-form="p1-issue"><div class="form-row"><div class="field"><label>Issue type</label><select name="kind"><option value="artwork">Artwork</option><option value="inventory">Inventory</option><option value="printing">Printing</option><option value="quality">Quality</option><option value="shipping">Shipping</option><option value="other">Other</option></select></div>'+
 '<div class="field"><label>Urgency</label><select name="severity"><option value="normal">Normal</option><option value="urgent">Urgent</option></select></div></div>'+
 '<div class="field"><label>Issue description</label><textarea name="message" maxlength="1200" required placeholder="Describe the problem and what you need from Veelad"></textarea></div>'+
 '<button type="submit" class="button danger">Report issue and pause production</button></form>':'';
 const issuePanel='<section class="card"><div class="card-title"><div><h2>Production issues</h2><p>Issues automatically pause production until resolved</p></div>'+
 '<span class="status '+(open.length?'on_hold':'packed')+'">'+open.length+' open</span></div>'+issuesHTML+issueForm+'</section>';
 return packagePanel+qcPanel+issuePanel;
}
async function click(button,context){
 const action=button.dataset.p1;if(!action)return false;
 const current=context.state.selected;
 if(action==='copy-invite'&&memory.invitationLink){
  await navigator.clipboard.writeText(memory.invitationLink);sdk.notice('Invitation link copied. Send it only to the intended employee.');return true;
 }
 if(action==='accept-invite'){
  if(!memory.pendingInvite)return true;
  await api('fulfillment-invite-accept',{method:'POST',body:{token:memory.pendingInvite}});
  memory.pendingInvite=null;sdk.notice('Supplier invitation accepted.');await sdk.refresh();return true;
 }
 if(action==='revoke'){
  if(!confirm('Revoke this invitation immediately?'))return true;
  await api('admin-fulfillment-invite-revoke',{method:'POST',body:{id:button.dataset.inviteId}});
  sdk.notice('Invitation revoked.');await loadTeam();context.render();return true;
 }
 if(action==='role'){
  const userId=button.dataset.userId,select=document.getElementById('p1-role-'+userId);
  await api('admin-fulfillment-role',{method:'POST',body:{supplier_id:memory.supplier,user_id:userId,role:select.value}});
  sdk.notice('Employee permission updated.');await loadTeam();context.render();return true;
 }
 if(action==='resolve-issue'&&current){
  const resolution=prompt('Describe how the issue was resolved (required).');
  if(resolution===null)return true;
  if(!resolution.trim())throw Error('Enter a resolution before closing the issue.');
  await api('fulfillment-issue-resolve',{method:'POST',body:{order_id:current.job.id,issue_id:button.dataset.issueId,resolution}});
  sdk.notice('Issue resolved. Supplier can resume after any remaining open issues are closed.');
  await sdk.openOrder(current.job.id);return true;
 }
 return false;
}
async function submit(form,context){
 const kind=form.dataset.form;
 if(!kind?.startsWith('p1-'))return false;
 const values=Object.fromEntries(new FormData(form));
 const current=context.state.selected,id=current?.job.id;
 if(kind==='p1-invite'){
  const result=await api('admin-fulfillment-invite',{method:'POST',body:{supplier_id:memory.supplier,email:values.email,role:values.role}});
  memory.invitationLink=result.invite_url;await loadTeam();context.render();sdk.notice(result.delivery==='queued'?'Invitation queued for email delivery.':'Invitation created. Copy and share its link privately.');return true;
 }
 if(kind==='p1-spec'){
  await api('admin-fulfillment-spec',{method:'POST',body:{supplier_id:memory.supplier,category:values.category,
   print_width_mm:Number(values.print_width_mm),print_height_mm:Number(values.print_height_mm),
   target_dpi:Number(values.target_dpi),bleed_mm:Number(values.bleed_mm),approved:values.approved==='on'}});
  sdk.notice('Supplier print specification confirmed.');await loadTeam();context.render();return true;
 }
 if(!id)throw Error('Open the order before making changes.');
 if(kind==='p1-pack-approve'){
  if(!confirm('Approve this exact production pack for the assigned supplier?'))return true;
  await api('admin-fulfillment-pack-approve',{method:'POST',body:{order_id:id,note:values.note||''}});
  sdk.notice('Approved production pack is now available to this supplier.');await sdk.openOrder(id);return true;
 }
 if(kind==='p1-photo'){
  const file=form.querySelector('input[name=photo]')?.files?.[0];
  if(!file||file.size>8*1024*1024)throw Error('Choose a PNG or JPEG photo under 8 MB.');
  const data=new FormData(form);data.append('order_id',id);
  const response=await fetch(sdk.urlFor('fulfillment-qc-photo-upload'),{method:'POST',credentials:'same-origin',
   headers:{'X-CSRF-Token':memory.session?.csrf||''},body:data,cache:'no-store'});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(result.error||'QC photo upload failed.');
  sdk.notice('Inspection photo saved privately.');await sdk.openOrder(id);return true;
 }
 if(kind==='p1-qc-review'){
  await api('fulfillment-qc-review',{method:'POST',body:{order_id:id,revision:current.job.revision,placement:values.placement==='on',colour:values.colour==='on',finish:values.finish==='on'}});
  sdk.notice('Quality control signed off. Confirm the quality stage to continue.');await sdk.openOrder(id);return true;
 }
 if(kind==='p1-issue'){
  await api('fulfillment-issue',{method:'POST',body:{order_id:id,revision:current.job.revision,kind:values.kind,severity:values.severity,message:values.message}});
  sdk.notice('Production issue reported. The job is now on hold.');await sdk.openOrder(id);return true;
 }
 return false;
}
async function change(element,context){
 if(element.id!=='p1-company')return false;
 memory.supplier=element.value;memory.invitationLink=null;await loadTeam();context.render();return true;
}
window.VeeladFulfillmentPhase1={
 configure(values){sdk=values;},
 bootstrap,loadJob,supplierPanel,orderPanel,inviteBanner,click,submit,change,can:allowed
};
})();
