(() => {
'use strict';
const $=id=>document.getElementById(id);
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt=value=>value?new Date(value).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
const status=value=>'<span class="status '+escapeHTML(value)+'">'+escapeHTML(String(value||'').replaceAll('_',' '))+'</span>';
const views=[
 {id:'overview',label:'Overview',icon:'◫',title:'Fulfillment overview',subtitle:'Track the production flow from a single workspace.'},
 {id:'orders',label:'Orders',icon:'▤',title:'Assigned orders',subtitle:'Every approved job, with its original order details.'},
 {id:'production',label:'Production',icon:'⚙',title:'Production pipeline',subtitle:'Move approved work through each manufacturing milestone.'},
 {id:'artwork',label:'Artwork & files',icon:'▧',title:'Artwork centre',subtitle:'Original design files and provisional placement instructions.'},
 {id:'shipping',label:'Shipping',icon:'↗',title:'Shipping desk',subtitle:'Prepare dispatch details and submit them for Veelad review.'},
 {id:'suppliers',label:'Suppliers',icon:'♙',title:'Supplier management',subtitle:'Manage company access and assign approved orders.',admin:true}
];
const state={session:null,activeSupplier:null,jobs:[],pool:[],selected:null,view:'overview',filter:'all',search:'',busy:false,phase1:null,adminSetup:{invites:[],specs:[]},inviteLink:'',invitationToken:new URLSearchParams(location.search).get('token')||null};
const urlFor=(route,params={})=>{
 const url=new URL('/api.php',location.origin);url.searchParams.set('route',route);
 Object.entries(params).forEach(([key,value])=>{if(value!==null&&value!==undefined&&value!=='')url.searchParams.set(key,String(value));});
 return url.toString();
};
async function api(route,{method='GET',body=null,params={}}={}){
 const headers={'Accept':'application/json'};
 if(method!=='GET'){headers['Content-Type']='application/json';headers['X-CSRF-Token']=state.session?.csrf||'';}
 let response;
 try{response=await fetch(urlFor(route,params),{method,credentials:'same-origin',headers,body:body?JSON.stringify(body):undefined,cache:'no-store'});}
 catch{throw Error('Cannot reach Veelad. Check your connection and retry.');}
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(payload.error||'The request could not be completed.');
 return payload;
}
const notice=(message,kind='info')=>{const el=$('notice');el.hidden=!message;el.textContent=message||'';el.classList.toggle('error',kind==='error');};
const empty=(heading,description)=>'<div class="empty"><div class="empty-icon">▦</div><h3>'+escapeHTML(heading)+'</h3><p>'+escapeHTML(description)+'</p></div>';
const heading=(title,subtitle,label='SUPPLIER WORKSPACE')=>{$('page-title').textContent=title;$('page-subtitle').textContent=subtitle;$('section-label').textContent=label;$('breadcrumb').textContent=title;};
function syncNavigation(){
 $('navigation').innerHTML=views.filter(x=>!x.admin||state.session?.admin).map(v=>'<button type="button" class="nav-button" data-view="'+v.id+'" aria-current="'+(v.id===state.view?'page':'false')+'"><span class="nav-icon" aria-hidden="true">'+v.icon+'</span>'+escapeHTML(v.label)+'</button>').join('');
 const options=state.session?.suppliers||[],picker=$('supplier-picker');
 picker.hidden=options.length===0;
 picker.innerHTML=state.session?.admin?'<option value="">All suppliers</option>':'';
 picker.innerHTML+=options.filter(s=>s.status!=='suspended').map(s=>'<option value="'+escapeHTML(s.id)+'">'+escapeHTML(s.name)+'</option>').join('');
 picker.value=state.activeSupplier||'';
 $('profile').textContent=state.session?.user?.name||'Account';
 $('avatar').textContent=(state.session?.user?.name||'V').slice(0,1).toUpperCase();
}
async function reload({preserveDetail=false}={}){
 if(!state.session)return;
 const params=state.activeSupplier?{supplier_id:state.activeSupplier}:{};
 const results=await Promise.all([
   state.session.admin||state.activeSupplier?api('fulfillment-orders',{params}):Promise.resolve({jobs:[]}),
   state.session.admin?api('admin-fulfillment-pool'):Promise.resolve({orders:[]})
 ]);
 state.jobs=results[0].jobs||[];state.pool=results[1].orders||[];
 if(preserveDetail&&state.selected){
  try{state.selected=(await api('fulfillment-order',{params:{order_id:state.selected.job.id}}));await loadPhase1(state.selected.job.id);}
  catch{state.selected=null;state.phase1=null;}
 }
 if(state.session?.admin)await loadAdminSetup();
 render();
}
function metric(label,count,icon,note=''){return '<div class="metric"><div class="metric-top">'+escapeHTML(label)+'<span class="metric-icon">'+icon+'</span></div><div class="metric-value">'+count+'</div><div class="metric-note">'+escapeHTML(note)+'</div></div>';}
function jobTable(jobs){
 if(!jobs.length)return empty('No jobs in this view','Approved production orders will appear here after they have been assigned by Veelad.');
 return '<div class="table-scroll"><table class="data-table"><thead><tr><th>Order</th><th>Items</th><th>Supplier</th><th>Production</th><th>Updated</th><th></th></tr></thead><tbody>'+
 jobs.map(j=>'<tr><td class="mono">'+escapeHTML(j.id)+'</td><td>'+j.items.length+' lines · '+j.items.reduce((n,x)=>n+Number(x.qty||0),0)+' units</td><td>'+escapeHTML(supplierName(j.supplier_id))+'</td><td>'+status(j.status)+'</td><td>'+fmt(j.updated_at)+'</td><td><button type="button" data-open="'+escapeHTML(j.id)+'">Open job</button></td></tr>').join('')+'</tbody></table></div>';
}
function supplierName(id){return state.session?.suppliers.find(s=>s.id===id)?.name||'Assigned supplier';}
function dashboard(){
 const jobs=state.jobs,active=jobs.filter(j=>!['packed','dispatch_submitted'].includes(j.status)),open=jobs.filter(j=>j.status==='assigned'),printing=jobs.filter(j=>['printing','quality_check'].includes(j.status)),hold=jobs.filter(j=>j.status==='on_hold');
 return '<div class="metrics">'+metric('Assigned orders',jobs.length,'▤','Visible to your supplier account')+metric('Ready to accept',open.length,'◷','Waiting for supplier acceptance')+metric('In production',printing.length,'⚙','Printing and quality checks')+metric('On hold',hold.length,'!','Require attention')+'</div>'+
 '<div class="two-col"><section class="card"><div class="card-title"><h2>Recent production jobs</h2><button type="button" class="text-link" data-view="orders">View all orders →</button></div>'+jobTable(jobs.slice(0,6))+'</section>'+
 '<section class="card"><div class="card-title"><h2>How the workflow works</h2></div><div class="stepper"><div class="step done">01 · Approval</div><div class="step">02 · Printing</div><div class="step">03 · Quality check</div><div class="step">04 · Dispatch</div></div><p class="section-subtitle">Veelad verifies payment and approves the final artwork before a supplier can download production files. Supplier updates remain auditable. Shipping requires a final Veelad administrator approval.</p><div class="hint">Only orders assigned to your company are visible. Artwork, customer delivery details and operational data must stay inside the authorized team.</div></section></div>';
}
function ordersView(scope='all'){
 const jobs=state.jobs.filter(j=>scope==='all'||(scope==='artwork'?true:scope==='shipping'?['packed','dispatch_submitted'].includes(j.status):['assigned','accepted','printing','quality_check','on_hold'].includes(j.status)));
 const filtered=jobs.filter(j=>(state.filter==='all'||j.status===state.filter)&&(!state.search||[j.id,...j.items.map(i=>i.title)].join(' ').toLowerCase().includes(state.search.toLowerCase())));
 const filters=Array.from(new Set(jobs.map(j=>j.status))).sort();
 return '<section class="card"><div class="card-title"><div><h2>'+escapeHTML(scope==='artwork'?'Order artwork files':scope==='shipping'?'Dispatch-ready orders':'Order queue')+'</h2><p>'+filtered.length+' matching jobs</p></div></div><div class="toolbar"><label class="sr-only" for="job-search">Search jobs</label><input id="job-search" placeholder="Search order or product…" value="'+escapeHTML(state.search)+'"><label class="sr-only" for="job-filter">Production status</label><select id="job-filter"><option value="all">All statuses</option>'+filters.map(s=>'<option value="'+escapeHTML(s)+'" '+(s===state.filter?'selected':'')+'>'+escapeHTML(s.replaceAll('_',' '))+'</option>').join('')+'</select></div>'+jobTable(filtered)+'</section>';
}
const steps=['assigned','accepted','printing','quality_check','packed','dispatch_submitted'];
const stageNames=['Assigned','Accepted','Printing','Quality check','Packed','Dispatch submitted'];
function progressPanel(job){
 const index=steps.indexOf(job.status),held=job.status==='on_hold';
 const next=index>=0&&index<steps.length-1?steps[index+1]:null;
 return '<section class="card"><div class="card-title"><div><h2>Production progress</h2><p>Updates are saved to the official order history.</p></div>'+status(job.status)+'</div>'+
 '<div class="stepper">'+steps.map((s,i)=>'<div class="step '+(!held&&i===index?'active':i<index?'done':'')+'"><span class="step-number">'+(i+1)+'</span>'+stageNames[i]+'</div>').join('')+'</div>'+
 (held?'<div class="hint">This job is on hold. The supplier must resolve the issue before work continues.</div><div class="actions" style="margin-top:15px"><button type="button" class="button accent" data-progress="resume">Resume previous step</button></div>':
 next==='dispatch_submitted'?'<form id="dispatch-form" data-form="dispatch"><div class="form-row"><div class="field"><label for="carrier">Shipping carrier</label><input id="carrier" name="carrier" maxlength="100" required placeholder="Carrier name"></div><div class="field"><label for="tracking">Tracking reference</label><input id="tracking" name="tracking" maxlength="120" required placeholder="Carrier tracking number"></div></div><button class="button accent" type="submit">Submit for dispatch approval</button></form>':
 next?'<div class="actions"><button class="button accent" type="button" data-progress="'+next+'">'+escapeHTML({'accepted':'Accept order','printing':'Start printing','quality_check':'Pass quality check','packed':'Confirm packaging'}[next]||'Continue')+'</button></div>':
 '<div class="hint">The supplier has submitted the shipment details. A Veelad administrator must approve the final dispatch.</div>')+
 (!held&&job.status!=='dispatch_submitted'?'<form id="hold-form" data-form="hold" style="margin-top:20px"><div class="field"><label for="hold-note">Production issue (required to pause)</label><textarea id="hold-note" name="note" maxlength="1000" placeholder="Explain the printing, artwork, inventory or quality concern…" required></textarea></div><button type="submit" class="button danger">Put production on hold</button></form>':'')+
 (state.session.admin&&job.status==='dispatch_submitted'?'<hr style="border:0;border-top:1px solid #eeeaf1;margin:22px 0"><div class="hint">Administrator action: approving dispatch marks the customer order shipped and sends the normal Veelad status notification when mail is configured.</div><button type="button" class="button accent" style="margin-top:15px" data-approve-dispatch="1">Approve customer dispatch</button>':'')+'</section>';
}
function detailView(){
 const d=state.selected;if(!d)return empty('Select an order','Choose an assigned order to open its production details.');
 const j=d.job;
 const items=d.items.map(i=>{
   const params={order_id:j.id,line_id:i.line_id};
   const links=[{label:'Job manifest · JSON',kind:'manifest'}];
   if(i.has_layout){
     if(i.surfaces.length){for(const surface of i.surfaces)links.push({label:'Layout · '+surface,kind:'layout',surface});}
     else links.push({label:'Composed layout · PNG',kind:'layout'});
   }
   for(const id of i.source_ids)links.push({label:'Original · '+id.slice(0,12),kind:'original',source_id:id});
   return '<div class="item-card"><h3>'+escapeHTML(i.title)+'</h3><p class="item-meta">'+escapeHTML(i.category)+' · '+escapeHTML(i.variant)+' · '+Number(i.qty||0)+' units'+(i.design_title?' · '+escapeHTML(i.design_title):'')+'<br>Line ID: <span class="mono">'+escapeHTML(i.line_id)+'</span></p><div class="file-list">'+links.map(link=>'<a href="'+escapeHTML(urlFor('fulfillment-artwork',{...params,kind:link.kind,...(link.surface?{surface:link.surface}:{}),...(link.source_id?{source_id:link.source_id}:{})}))+'" download>'+escapeHTML(link.label)+' ↓</a>').join('')+'</div></div>';
 }).join('');
 const shipping=d.shipping?'<dl>'+Object.entries(d.shipping).filter(([,v])=>v).map(([key,value])=>'<div class="value-block"><dt>'+escapeHTML(key.replaceAll('_',' '))+'</dt><dd>'+escapeHTML(value)+'</dd></div>').join('')+'</dl>':'<div class="hint">The delivery address becomes available to the authorized supplier once the order is packed.</div>';
 return '<div class="actions" style="margin-bottom:17px"><button type="button" class="button secondary" data-view="orders">← All orders</button><span class="pill-note">Order '+escapeHTML(j.id)+'</span>'+(d.test_order?'<span class="status on_hold">Test payment · staging only</span>':'')+'</div>'+
 '<div class="metrics">'+metric('Items',j.items.length,'▦')+metric('Units',j.items.reduce((n,x)=>n+Number(x.qty||0),0),'◫')+metric('Order status',escapeHTML(j.order_status||'—'),'◷')+metric('Revision',j.revision,'↻')+'</div>'+
 '<div class="two-col"><div>'+progressPanel(j)+preflightPanel()+evidencePanel()+issuesPanel()+'<section class="card"><div class="card-title"><h2>Print artwork & job sheets</h2></div><p class="section-subtitle">These files are based on the exact purchased designs, not the current product catalogue. Artwork is provisional until the supplier verifies printable dimensions, colour, bleed and quality.</p>'+items+'</section></div><div>'+
 '<section class="card"><div class="card-title"><h2>Supplier assignment</h2></div><dl><div class="value-block"><dt>Company</dt><dd>'+escapeHTML(supplierName(j.supplier_id))+'</dd></div><div class="value-block"><dt>Placed</dt><dd>'+fmt(j.created_at)+'</dd></div><div class="value-block"><dt>Last updated</dt><dd>'+fmt(j.updated_at)+'</dd></div><div class="value-block"><dt>Payment</dt><dd>'+(d.payment_verified?'Verified':'Not verified')+'</dd></div><div class="value-block"><dt>Veelad production</dt><dd>'+escapeHTML(d.production_stage.replaceAll('_',' '))+'</dd></div></dl></section>'+
 '<section class="card"><div class="card-title"><h2>Shipping information</h2></div>'+shipping+(d.tracking?'<div class="hint">Submitted tracking: '+escapeHTML(d.carrier)+' / '+escapeHTML(d.tracking)+'</div>':'')+'</section>'+
 (d.issue?'<section class="card"><div class="card-title"><h2>Last reported issue</h2></div><p class="section-subtitle">'+escapeHTML(d.issue)+'</p></section>':'')+
 '</div></div>';
}
function suppliersView(){
 const supplierOptions=(state.session?.suppliers||[]).filter(s=>s.status==='active').map(s=>'<option value="'+escapeHTML(s.id)+'">'+escapeHTML(s.name)+'</option>').join('');
 return '<div class="metrics">'+metric('Supplier companies',(state.session?.suppliers||[]).length,'♙')+metric('Assigned jobs',state.jobs.length,'▤')+metric('Ready for assignment',state.pool.length,'◷')+metric('On hold',state.jobs.filter(j=>j.status==='on_hold').length,'!')+'</div>'+
 '<div class="two-col"><section class="card"><div class="card-title"><div><h2>Supplier companies</h2><p>Separate access boundaries for each manufacturing partner.</p></div></div>'+
 '<form data-form="supplier"><div class="field"><label for="new-supplier">Company name</label><input id="new-supplier" name="name" maxlength="120" placeholder="e.g. Merchlist" required></div><button class="button accent" type="submit">Add supplier</button></form>'+
 '<div class="table-scroll" style="margin-top:17px"><table class="data-table"><thead><tr><th>Company</th><th>Status</th></tr></thead><tbody>'+(state.session?.suppliers||[]).map(s=>'<tr><td>'+escapeHTML(s.name)+'</td><td>'+status(s.status)+' <button type="button" class="text-link" data-supplier-status="'+escapeHTML(s.id)+'">'+(s.status==='active'?'Suspend':'Reactivate')+'</button></td></tr>').join('')+'</tbody></table></div></section>'+
 '<section class="card"><div class="card-title"><div><h2>Grant employee access</h2><p>Suppliers use existing Veelad accounts, with explicit approval.</p></div></div><form data-form="member"><div class="field"><label for="member-supplier">Supplier</label><select id="member-supplier" name="supplier_id" required>'+supplierOptions+'</select></div><div class="field"><label for="member-email">Existing account email</label><input id="member-email" name="email" type="email" autocomplete="off" placeholder="team@example.com" required></div><div class="field"><label for="member-access">Access</label><select id="member-access" name="access"><option value="active">Grant access</option><option value="suspended">Suspend access</option></select></div><button class="button accent" type="submit" '+(!supplierOptions?'disabled':'')+'>Update employee access</button></form><p class="form-help" style="margin-top:12px">Never share account passwords. Grant each employee their own role. Suspending a membership blocks its supplier access immediately.</p></section></div>'+
 '<section class="card"><div class="card-title"><div><h2>Assign an approved order</h2><p>Only paid processing orders with approved proofs appear here.</p></div></div>'+
 (state.pool.length?'<form data-form="assign"><div class="form-row"><div class="field"><label for="assign-order">Approved order</label><select name="order_id" id="assign-order" required>'+state.pool.map(o=>'<option value="'+escapeHTML(o.id)+'">'+escapeHTML(o.id)+' · '+o.items.length+' item lines</option>').join('')+'</select></div><div class="field"><label for="assign-supplier">Fulfillment company</label><select name="supplier_id" id="assign-supplier" required>'+supplierOptions+'</select></div></div><button class="button accent" '+(!supplierOptions?'disabled':'')+' type="submit">Assign selected order</button></form>':empty('No orders ready to assign','Complete a test checkout, record the staging payment and approve each order proof before releasing a job.'))+'</section>'+adminPhaseOnePanel();
}

async function loadPhase1(id){
 const [preflight,evidence,issues]=await Promise.all([
  api('fulfillment-preflight',{params:{order_id:id}}),
  api('fulfillment-evidence',{params:{order_id:id}}),
  api('fulfillment-issues',{params:{order_id:id}})
 ]);
 state.phase1={preflight,evidence:evidence.evidence||[],issues:issues.issues||[]};
}
async function loadAdminSetup(){
 const id=state.activeSupplier||state.session?.suppliers?.find(s=>s.status==='active')?.id;
 if(!id){state.adminSetup={invites:[],specs:[]};return;}
 try{
  const [inv,spec]=await Promise.all([
   api('admin-fulfillment-invites',{params:{supplier_id:id}}),
   api('admin-fulfillment-print-specs',{params:{supplier_id:id}})
  ]);
  state.adminSetup={supplier_id:id,invites:inv.invites||[],specs:spec.specs||[]};
 }catch{state.adminSetup={supplier_id:id,invites:[],specs:[]};}
}
function preflightPanel(){
 if(!state.phase1)return '';
 const p=state.phase1.preflight,r=p.report,approved=p.approved;
 return '<section class="card"><div class="card-title"><div><h2>Print specification & validation</h2><p>Validated against approved supplier templates and artwork metadata.</p></div>'+status(approved?'approved':r.blocks.length?'on_hold':'awaiting_approval')+'</div>'+
 '<div class="hint">Print approval is not a factory certification. Verify correct garment, surfaces, position, transparency, CMYK/profile, physical measurements and samples with your supplier.</div>'+
 '<div class="qc-kpis"><span>Product lines: <strong>'+r.checks.length+'</strong></span><span>Blocking issues: <strong>'+r.blocks.length+'</strong></span><span>Manual reviews: <strong>'+r.warnings.length+'</strong></span></div>'+
 (r.blocks.length?'<h3 class="small-heading">Must be resolved</h3><ul class="audit-list">'+r.blocks.map(b=>'<li class="critical-item">'+escapeHTML(b)+'</li>').join('')+'</ul>':'<p class="good-copy">No automatic metadata blockers found.</p>')+
 (r.checks.length?'<div class="table-scroll"><table class="data-table"><thead><tr><th>Line</th><th>Print area</th><th>Min. DPI</th><th>Sources</th></tr></thead><tbody>'+r.checks.map(x=>'<tr><td>'+escapeHTML(x.line_id)+'</td><td>'+x.spec.print_width_mm+' × '+x.spec.print_height_mm+' mm</td><td>'+x.spec.min_dpi+'</td><td>'+x.source_metadata.map(m=>escapeHTML(m.effective_dpi+' DPI')).join(', ')+'</td></tr>').join('')+'</tbody></table></div>':'')+
 (r.warnings.length?'<details class="detail-expander"><summary>'+r.warnings.length+' manual checks required</summary><ul class="audit-list">'+r.warnings.map(x=>'<li>'+escapeHTML(x)+'</li>').join('')+'</ul></details>':'')+
 (approved?'<p class="good-copy">Approved by Veelad · '+fmt(p.approval.approved_at)+' · Approval is bound to this exact purchased design and print template.</p>':state.session.admin?'<form data-form="preflight"><label class="field"><span>Manual supplier-template review and sign-off</span><textarea name="review_note" minlength="15" required placeholder="Confirm Merchlist print area, bleed, colour profile, layer scale, garment specifications and physical proof."></textarea></label><label class="checkline"><input type="checkbox" name="confirm" value="yes" required> I have verified the manufacturing requirements outside the automated checks.</label><button class="button accent" type="submit" '+(r.blocks.length?'disabled':'')+'>Approve this print pack</button></form>':'<div class="hint">Waiting for Veelad to approve the supplier-specific print pack.</div>')+
 '</section>';
}
function evidencePanel(){
 if(!state.phase1)return '';
 const d=state.selected,e=state.phase1.evidence,reviewer=state.session.admin||['quality','manager'].includes(state.session?.suppliers?.find(s=>s.id===d.job.supplier_id)?.supplier_role);
 return '<section class="card"><div class="card-title"><div><h2>Photographic quality control</h2><p>Each order line needs an approved final-print photograph from a separate reviewer.</p></div></div>'+
 '<form data-form="photo"><div class="form-row"><label class="field"><span>Order line</span><select name="line_id" required>'+d.items.map(i=>'<option value="'+escapeHTML(i.line_id)+'">'+escapeHTML(i.title)+' · '+escapeHTML(i.variant)+'</option>').join('')+'</select></label><label class="field"><span>Inspection photo type</span><select name="kind"><option value="final_print">Final printed product</option><option value="placement">Artwork placement</option><option value="packaging">Packaging</option></select></label></div><label class="field"><span>Photo (PNG/JPEG, up to 8 MB)</span><input type="file" name="photo" accept="image/png,image/jpeg" required></label><button class="button accent" type="submit">Upload inspection photograph</button></form>'+
 (e.length?'<div class="evidence-grid">'+e.map(x=>'<div class="evidence-card"><a target="_blank" rel="noopener noreferrer" href="'+escapeHTML(urlFor('fulfillment-evidence-file',{order_id:d.job.id,evidence_id:x.id}))+'"><img loading="lazy" src="'+escapeHTML(urlFor('fulfillment-evidence-file',{order_id:d.job.id,evidence_id:x.id}))+'" alt="Production inspection photo for '+escapeHTML(x.line_id)+'"></a><div class="evidence-meta"><strong>'+escapeHTML(x.line_id)+'</strong><span>'+escapeHTML(x.kind.replaceAll('_',' '))+'</span><span>'+status(x.status)+'</span></div>'+(x.review_note?'<p>'+escapeHTML(x.review_note)+'</p>':'')+(reviewer&&x.status==='pending'?'<div class="actions"><button class="button secondary" data-review="'+escapeHTML(x.id)+'" data-decision="approved">Approve</button><button class="button danger" data-review="'+escapeHTML(x.id)+'" data-decision="rejected">Reject</button></div>':'')+'</div>').join('')+'</div>':empty('No inspection photos','Upload real photos for each order line, then have a separate quality reviewer approve them.'))+
 '</section>';
}
function issuesPanel(){
 if(!state.phase1)return '';
 const issues=state.phase1.issues,canResolve=state.session.admin||['manager','quality'].includes(state.session.suppliers.find(s=>s.id===state.selected.job.supplier_id)?.supplier_role);
 return '<section class="card"><div class="card-title"><div><h2>Production issues & escalations</h2><p>Every issue is recorded, tracked and must be resolved before resuming work.</p></div>'+status(issues.some(x=>x.status==='open')?'on_hold':'resolved')+'</div>'+
 '<form data-form="issue"><div class="form-row"><label class="field"><span>Issue type</span><select name="category"><option value="artwork">Artwork</option><option value="print_quality">Printing quality</option><option value="materials">Materials</option><option value="dimensions">Dimensions</option><option value="packaging">Packaging</option><option value="shipping">Shipping</option><option value="other">Other</option></select></label><label class="field"><span>Severity</span><select name="severity"><option value="medium">Medium</option><option value="low">Low</option><option value="high">High</option><option value="critical">Critical</option></select></label></div><label class="field"><span>Explain the problem</span><textarea name="note" minlength="10" maxlength="1000" required placeholder="Which product or print was affected, and what needs to change?"></textarea></label><button class="button danger" type="submit">Report issue and pause production</button></form>'+
 (issues.length?'<div class="issue-list">'+issues.map(x=>'<div class="issue-item"><div class="status-line"><strong>'+escapeHTML(x.category.replaceAll('_',' '))+'</strong> '+status(x.status)+' <span class="secondary-text">'+escapeHTML(x.severity)+' · '+fmt(x.created_at)+'</span></div><p>'+escapeHTML(x.note)+'</p>'+(x.resolution?'<p class="good-copy">Resolution: '+escapeHTML(x.resolution)+'</p>':'')+(x.status==='open'&&canResolve?'<button class="button secondary" data-resolve="'+escapeHTML(x.id)+'">Record resolution</button>':'')+'</div>').join('')+'</div>':'')+'</section>';
}
function adminPhaseOnePanel(){
 if(!state.session?.admin)return '';
 const id=state.adminSetup.supplier_id||'',opts=state.session.suppliers.filter(x=>x.status==='active').map(s=>'<option value="'+escapeHTML(s.id)+'" '+(s.id===id?'selected':'')+'>'+escapeHTML(s.name)+'</option>').join('');
 const roles='<option value="production">Production operator</option><option value="quality">Quality reviewer</option><option value="manager">Supplier manager</option>';
 return '<div class="two-col"><section class="card"><div class="card-title"><div><h2>Secure supplier invitations</h2><p>Invite links are one-time, expire after 48 hours, and require the exact email to sign in.</p></div></div><form data-form="invite"><label class="field"><span>Supplier company</span><select name="supplier_id" required>'+opts+'</select></label><label class="field"><span>Employee email</span><input name="email" type="email" placeholder="operator@merchlist.example" required></label><label class="field"><span>Supplier permissions</span><select name="supplier_role">'+roles+'</select></label><button class="button accent" type="submit" '+(!id?'disabled':'')+'>Generate secure invite</button></form>'+
 (state.inviteLink?'<div class="invite-link"><label for="invite-link">One-time invitation URL — copy now; it will not be shown again</label><input readonly id="invite-link" value="'+escapeHTML(state.inviteLink)+'"><button type="button" class="button secondary" data-copy-invite>Copy invitation link</button><p class="form-help">Staging intentionally does not email third parties. Share the link only with the verified recipient.</p></div>':'')+
 '<div class="section-list">'+state.adminSetup.invites.slice(0,12).map(x=>'<div class="issue-item"><div class="status-line"><strong>'+escapeHTML(x.email)+'</strong>'+status(x.revoked_at?'revoked':x.accepted_at?'approved':new Date(x.expires_at)<new Date()?'expired':'pending')+'</div><p class="form-help">'+escapeHTML(x.supplier_role)+' · Expires '+fmt(x.expires_at)+'</p>'+(!x.revoked_at&&!x.accepted_at?'<button type="button" class="button danger" data-revoke-invite="'+escapeHTML(x.id)+'">Revoke</button>':'')+'</div>').join('')+'</div></section>'+
 '<section class="card"><div class="card-title"><div><h2>Supplier print specification templates</h2><p>Enter confirmed factory limits — never guess these measurements.</p></div></div><form data-form="print-spec"><label class="field"><span>Supplier</span><select name="supplier_id" required>'+opts+'</select></label><label class="field"><span>Product category (exact Veelad category)</span><input name="category" list="phase1-categories" placeholder="T-shirts" required></label><datalist id="phase1-categories"><option value="T-shirts"><option value="Hoodies"><option value="Sweatshirts"><option value="Art prints"></datalist><div class="form-row"><label class="field"><span>Printable width (mm)</span><input name="print_width_mm" type="number" min="10" max="2000" required></label><label class="field"><span>Printable height (mm)</span><input name="print_height_mm" type="number" min="10" max="2000" required></label></div><div class="form-row"><label class="field"><span>Bleed (mm)</span><input name="bleed_mm" type="number" min="0" max="100" value="0" required></label><label class="field"><span>Minimum DPI</span><input name="min_dpi" type="number" min="100" max="1200" value="300" required></label></div><button class="button accent" type="submit" '+(!id?'disabled':'')+'>Save verified print template</button></form>'+
 (state.adminSetup.specs.length?'<div class="table-scroll"><table class="data-table"><thead><tr><th>Category</th><th>Print area</th><th>Resolution</th></tr></thead><tbody>'+state.adminSetup.specs.map(s=>'<tr><td>'+escapeHTML(s.category)+'</td><td>'+s.print_width_mm+' × '+s.print_height_mm+' mm</td><td>'+s.min_dpi+' DPI</td></tr>').join('')+'</tbody></table></div>':'<p class="hint">No printing templates have been confirmed. Production preflight will remain blocked until you add them.</p>')+'</section></div>';
}

function render(){
 if(!state.session){heading('Secure fulfillment workspace','Sign in with your approved Veelad account.');$('content').innerHTML='<section class="card">'+empty(state.invitationToken?'Sign in to accept your invitation':'Sign in required',state.invitationToken?'Sign in using the exact email address on the invitation, then return to this link.':'This workspace is private to Veelad administrators and authorized manufacturing partners.')+'<div class="actions" style="justify-content:center"><a class="button accent" href="/en/login">Sign in to Veelad</a></div></section>';return;}
 syncNavigation();
 if(state.invitationToken){
  heading('Join your supplier workspace','Your invitation is one-time and restricted to your approved Veelad email account.');
  $('content').innerHTML='<section class="card">'+empty('Supplier invitation','Confirm that you trust the Veelad administrator who shared this link. Access will be restricted to the invited supplier company and role.')+'<div class="actions" style="justify-content:center"><button type="button" class="button accent" data-accept-invite>Accept supplier invitation</button></div></section>';return;
 }
 if(!state.session.admin&&state.session.suppliers.length===0){heading('Supplier access required','Your account needs to be approved by Veelad.');$('content').innerHTML='<section class="card">'+empty('No supplier permissions','Ask the Veelad administrator to invite your registered account to your company. No order data is available until access is granted.')+'</section>';return;}
 const section=views.find(v=>v.id===state.view)||views[0];
 heading(state.selected?'Production order '+state.selected.job.id:section.title,state.selected?'Review artwork, quality and shipping status.':section.subtitle, state.session.admin?'VEELAD · OPERATIONS ADMIN':'SUPPLIER WORKSPACE');
 if(state.selected){$('content').innerHTML=detailView();return;}
 $('content').innerHTML=state.view==='overview'?dashboard():state.view==='suppliers'&&state.session.admin?suppliersView():ordersView(state.view);
}
async function openOrder(id){state.selected=await api('fulfillment-order',{params:{order_id:id}});await loadPhase1(id);render();window.scrollTo({top:0,behavior:'smooth'});}
async function progress(action,extra={}){
 if(!state.selected)return;
 const j=state.selected.job;
 if(['quality_check','packed'].includes(action)&&!confirm('Confirm that this production quality / packaging check has genuinely been completed?'))return;
 await api('fulfillment-progress',{method:'POST',body:{order_id:j.id,revision:j.revision,action,...extra}});
 notice('Production update saved.');await reload({preserveDetail:true});
}
async function submit(form){
 const data=Object.fromEntries(new FormData(form));
 if(form.dataset.form==='supplier')await api('admin-fulfillment-supplier',{method:'POST',body:{name:data.name,status:'active'}});
 if(form.dataset.form==='member')await api('admin-fulfillment-member',{method:'POST',body:data});
 if(form.dataset.form==='assign')await api('admin-fulfillment-assign',{method:'POST',body:data});
 if(form.dataset.form==='hold')return progress('hold',{note:data.note});
 if(form.dataset.form==='dispatch')return progress('dispatch_submitted',{carrier:data.carrier,tracking:data.tracking});
 notice('Changes saved successfully.');await bootstrap();
}
async function bootstrap(){
 try{
  state.session=await api('fulfillment-session');state.activeSupplier=state.session.admin?state.activeSupplier:(state.session.suppliers[0]?.id||null);
  if(state.session.admin&&state.activeSupplier&&!state.session.suppliers.some(s=>s.id===state.activeSupplier))state.activeSupplier=null;
  $('environment').textContent=location.hostname.startsWith('staging.')?'STAGING':'';
  state.selected=null;await reload();
 }catch(error){
  if(error.message==='Please sign in to continue.'){state.session=null;render();return;}
  notice(error.message,'error');state.session=null;render();
 }
}
$('navigation').addEventListener('click',event=>{
 const button=event.target.closest('[data-view]');if(!button)return;
 state.view=button.dataset.view;state.selected=null;state.filter='all';state.search='';render();
});
$('supplier-picker').addEventListener('change',async event=>{
 state.activeSupplier=event.target.value||null;state.selected=null;
 try{await reload();notice('');}catch(error){notice(error.message,'error');}
});
$('refresh').addEventListener('click',async()=>{try{await bootstrap();notice('Workspace refreshed.');}catch(error){notice(error.message,'error');}});
$('content').addEventListener('click',async event=>{
 const b=event.target.closest('button');if(!b)return;
 try{
  b.disabled=true;
  if(b.dataset.view){state.view=b.dataset.view;state.selected=null;render();}
  else if(b.dataset.open)await openOrder(b.dataset.open);
  else if(b.dataset.progress)await progress(b.dataset.progress);
  else if(b.dataset.supplierStatus){
   const supplier=state.session.suppliers.find(x=>x.id===b.dataset.supplierStatus);
   if(supplier&&confirm((supplier.status==='active'?'Suspend':'Reactivate')+' supplier '+supplier.name+'?')){
    await api('admin-fulfillment-supplier',{method:'POST',body:{id:supplier.id,name:supplier.name,status:supplier.status==='active'?'suspended':'active'}});
    notice('Supplier access updated.');await bootstrap();
   }
  }
  else if(b.dataset.approveDispatch){
   if(confirm('Approve carrier tracking and mark this order shipped?')){
    await api('admin-fulfillment-dispatch',{method:'POST',body:{order_id:state.selected.job.id}});notice('Dispatch approved. Customer order marked as shipped.');state.selected=null;await reload();
   }
  }
 }catch(error){notice(error.message,'error');}finally{b.disabled=false;}
});
$('content').addEventListener('submit',async event=>{
 const form=event.target.closest('[data-form]');if(!form)return;
 event.preventDefault();const button=form.querySelector('button[type=submit]');if(button)button.disabled=true;
 try{await submit(form);}catch(error){notice(error.message,'error');}finally{if(button)button.disabled=false;}
});
$('content').addEventListener('change',event=>{if(event.target.id==='job-filter'){state.filter=event.target.value;render();}});
$('content').addEventListener('input',event=>{if(event.target.id==='job-search'){state.search=event.target.value;const pos=event.target.selectionStart;render();const input=$('job-search');input?.focus();input?.setSelectionRange(pos,pos);}});
bootstrap();
})();
