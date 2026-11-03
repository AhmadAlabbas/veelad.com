(() => {
'use strict';
const $=id=>document.getElementById(id);
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt=value=>value?new Date(value).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
const status=value=>'<span class="status '+escapeHTML(value)+'">'+escapeHTML(String(value||'').replaceAll('_',' '))+'</span>';
const views=[
 {id:'overview',label:'Dashboard',icon:'◫',title:'Manufacturing dashboard',subtitle:'Merchlist production, quality checks and dispatch in one secure workspace.'},
 {id:'orders',label:'Orders',icon:'▤',title:'Manufacturing orders',subtitle:'Paid orders with approved artwork assigned to your company.'},
 {id:'production',label:'Printing',icon:'⚙',title:'Print queue',subtitle:'Accepted orders currently in production.'},
 {id:'quality',label:'Quality control',icon:'✓',title:'Quality review',subtitle:'Inspect finished prints and submit approval evidence.'},
 {id:'artwork',label:'Print files',icon:'▧',title:'Approved artwork',subtitle:'Download original files and approved production packs.'},
 {id:'shipping',label:'Shipping',icon:'↗',title:'Dispatch and shipping',subtitle:'Pack orders, record carrier tracking and request dispatch approval.'},
 {id:'packaging',label:'Packing',icon:'▣',title:'Packing desk',subtitle:'Check Veelad-branded packaging rules and sign off approved orders.'},
 {id:'messages',label:'Messages',icon:'✉',title:'Order communication',subtitle:'Private conversations between Veelad and your production team.'},
 {id:'bulk',label:'Bulk operations',icon:'☷',title:'Batch operations',subtitle:'Accept assigned jobs and export picking lists.'},
 {id:'notifications',label:'Alerts',icon:'◉',title:'Operations alerts',subtitle:'Assignments, deadlines, issues and shipping updates.'},
 {id:'split',label:'Product lines',icon:'◈',title:'Individual product jobs',subtitle:'Every supplier sees only the purchased product lines assigned to its own company.'},
 {id:'analytics',label:'Performance',icon:'▥',title:'Supplier performance',subtitle:'On-time performance, quality issues and production throughput.'},
 {id:'invoices',label:'Manufacturing invoices',icon:'▣',title:'Supplier manufacturing invoices',subtitle:'Separate factory-cost records with approval and external settlement tracking.'},
 {id:'routing',label:'Route by product',icon:'↗',title:'Assign products to suppliers',subtitle:'Assign every purchased product line to one verified manufacturing supplier.',admin:true},
 {id:'integrations',label:'Integration API',icon:'⌘',title:'Supplier API credentials',subtitle:'Create expiring read-only or limited-update credentials for external systems.',admin:true},
 {id:'suppliers',label:'Suppliers',icon:'♙',title:'Supplier management',subtitle:'Manage company access and assign approved orders.',admin:true}
];
const state={session:null,authCsrf:null,authMode:'login',activeSupplier:null,jobs:[],pool:[],selected:null,view:'overview',filter:'all',search:'',busy:false,phase1:null,adminSetup:{invites:[],specs:[]},inviteLink:'',phase2:null,ops:{jobs:[]},alerts:{notifications:[],unread:0},adminOps:{id:null,rules:[],policy:null},phase3:{jobs:[],candidates:{orders:[],suppliers:[]},analytics:[],invoices:[],keys:[],selected:null,routeOrder:null,invoice:null,lastToken:null},invitationToken:new URLSearchParams(location.hash.replace(/^#/, '')).get('token')||new URLSearchParams(location.search).get('token')||null};
const urlFor=(route,params={})=>{
 const url=new URL('/api.php',location.origin);url.searchParams.set('route',route);
 Object.entries(params).forEach(([key,value])=>{if(value!==null&&value!==undefined&&value!=='')url.searchParams.set(key,String(value));});
 return url.toString();
};
async function api(route,{method='GET',body=null,params={}}={}){
 const headers={'Accept':'application/json'};
 if(route==='bootstrap')headers['X-veelad-catalogue']='deferred';
 if(method!=='GET'){headers['Content-Type']='application/json';headers['X-CSRF-Token']=state.session?.csrf||state.authCsrf||'';}
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
 const supplierSections=new Set(['overview','orders','production','quality','packaging','shipping','artwork','messages','notifications','split','analytics']);
 $('navigation').innerHTML=views.filter(x=>state.session?.admin||supplierSections.has(x.id)).map(v=>'<button type="button" class="nav-button" data-view="'+v.id+'" aria-current="'+(v.id===state.view?'page':'false')+'"><span class="nav-icon" aria-hidden="true">'+v.icon+'</span>'+escapeHTML(v.label)+'</button>').join('');
 const options=state.session?.suppliers||[],picker=$('supplier-picker');
 picker.hidden=options.length===0;
 picker.innerHTML=state.session?.admin?'<option value="">All suppliers</option>':'';
 picker.innerHTML+=options.filter(s=>s.status!=='suspended').map(s=>'<option value="'+escapeHTML(s.id)+'">'+escapeHTML(s.name)+'</option>').join('');
 picker.value=state.activeSupplier||'';
 $('profile').textContent=state.session?.user?.name||'Account';
 $('environment').textContent=location.hostname.startsWith('staging.')?'STAGING':'';
 const company=state.session?.admin?'Veelad operations':state.session?.suppliers?.[0]?.name||'Supplier';
 const marker=document.querySelector('.workspace-label');if(marker)marker.innerHTML='<span class="pulse"></span> '+escapeHTML(company)+' <span class="version">PRODUCTION</span>';
 $('sign-out').hidden=false;
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
  try{state.selected=(await api('fulfillment-order',{params:{order_id:state.selected.job.id}}));await Promise.all([loadPhase1(state.selected.job.id),loadPhase2(state.selected.job.id)]);}
  catch{state.selected=null;state.phase1=null;}
 }
 await Promise.all([loadOperations(),loadPhase3()]);
 if(state.session?.admin)await Promise.all([loadAdminSetup(),loadAdminOperations()]);
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
 '<section class="card"><div class="card-title"><h2>How the workflow works</h2></div><div class="stepper"><div class="step done">01 · Approval</div><div class="step">02 · Printing</div><div class="step">03 · Quality check</div><div class="step">04 · Dispatch</div></div><p class="section-subtitle">Veelad verifies payment and approves the final artwork before a supplier can download production files. Supplier updates remain auditable. Shipping requires a final Veelad administrator approval.</p><div class="hint">Only orders assigned to your company are visible. Artwork, customer delivery details and operational data must stay inside the authorized team.</div></section></div>'+overviewOps();
}
function ordersView(scope='all'){
 const statusFor={shipping:['packed','dispatch_submitted'],production:['accepted','printing','on_hold'],quality:['quality_check'],packing:['quality_check','packed']};
 const jobs=state.jobs.filter(j=>!statusFor[scope]||statusFor[scope].includes(j.status));
 const filtered=jobs.filter(j=>(state.filter==='all'||j.status===state.filter)&&(!state.search||[j.id,...j.items.map(i=>i.title)].join(' ').toLowerCase().includes(state.search.toLowerCase())));
 const filters=Array.from(new Set(jobs.map(j=>j.status))).sort();
 return '<section class="card"><div class="card-title"><div><h2>'+escapeHTML({artwork:'Approved artwork and production files',shipping:'Ready for carrier handoff',production:'Printing work queue',quality:'Awaiting quality approval',packing:'Ready for packing'}[scope]||'All supplier orders')+'</h2><p>'+filtered.length+' matching jobs</p></div></div><div class="toolbar"><label class="sr-only" for="job-search">Search jobs</label><input id="job-search" placeholder="Search order or product…" value="'+escapeHTML(state.search)+'"><label class="sr-only" for="job-filter">Production status</label><select id="job-filter"><option value="all">All statuses</option>'+filters.map(s=>'<option value="'+escapeHTML(s)+'" '+(s===state.filter?'selected':'')+'>'+escapeHTML(s.replaceAll('_',' '))+'</option>').join('')+'</select></div>'+jobTable(filtered)+'</section>';
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
 '<div class="two-col"><div>'+progressPanel(j)+packingPanel()+conversationPanel()+shippingEventsPanel()+preflightPanel()+evidencePanel()+issuesPanel()+'<section class="card"><div class="card-title"><h2>Print artwork & job sheets</h2></div><p class="section-subtitle">These files are based on the exact purchased designs, not the current product catalogue. Artwork is provisional until the supplier verifies printable dimensions, colour, bleed and quality.</p>'+items+'</section></div><div>'+
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
 '<section class="card"><div class="card-title"><div><h2>Grant employee access</h2><p>Suppliers use existing Veelad accounts, with explicit approval.</p></div></div><form data-form="member"><div class="field"><label for="member-supplier">Supplier</label><select id="member-supplier" name="supplier_id" required>'+supplierOptions+'</select></div><div class="field"><label for="member-email">Existing account email</label><input id="member-email" name="email" type="email" autocomplete="off" placeholder="team@example.com" required></div><div class="field"><label for="member-role">Supplier permissions</label><select id="member-role" name="supplier_role"><option value="production">Production operator</option><option value="quality">Quality reviewer</option><option value="manager">Supplier manager</option></select></div><div class="field"><label for="member-access">Access</label><select id="member-access" name="access"><option value="active">Grant access</option><option value="suspended">Suspend access</option></select></div><button class="button accent" type="submit" '+(!supplierOptions?'disabled':'')+'>Update employee access</button></form><p class="form-help" style="margin-top:12px">Never share account passwords. Grant each employee their own role. Suspending a membership blocks its supplier access immediately.</p></section></div>'+
 '<section class="card"><div class="card-title"><div><h2>Assign an approved order</h2><p>Only paid processing orders with approved proofs appear here.</p></div></div>'+
 (state.pool.length?'<div class="hint">Approved orders are assignable here. An order already marked Printing requires explicit confirmation before linking it, to prevent duplicate manufacturing.</div><form data-form="assign"><div class="form-row"><div class="field"><label for="assign-order">Approved order</label><select name="order_id" id="assign-order" required>'+state.pool.map(o=>'<option value="'+escapeHTML(o.id)+'">'+escapeHTML(o.id)+' · '+o.items.length+' item lines'+(o.needs_reconciliation?' · ALREADY PRINTING — REVIEW':'')+'</option>').join('')+'</select></div><div class="field"><label for="assign-supplier">Fulfillment company</label><select name="supplier_id" id="assign-supplier" required>'+supplierOptions+'</select></div></div><button class="button accent" '+(!supplierOptions?'disabled':'')+' type="submit">Assign selected order</button></form>':empty('No orders ready to assign','Complete a test checkout, record the staging payment and approve each order proof before releasing a job.'))+'</section>'+adminPhaseOnePanel()+adminPhaseTwoPanel();
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
 (approved?'<p class="good-copy">Approved by Veelad · '+fmt(p.approval.approved_at)+' · Approval is bound to this exact purchased design and print template.</p><a class="button accent" href="'+escapeHTML(urlFor('fulfillment-pack',{order_id:state.selected.job.id}))+'" download>↓ Download approved production pack (ZIP)</a>':state.session.admin?'<form data-form="preflight"><label class="field"><span>Manual supplier-template review and sign-off</span><textarea name="review_note" minlength="15" required placeholder="Confirm Merchlist print area, bleed, colour profile, layer scale, garment specifications and physical proof."></textarea></label><label class="checkline"><input type="checkbox" name="confirm" value="yes" required> I have verified the manufacturing requirements outside the automated checks.</label><button class="button accent" type="submit" '+(r.blocks.length?'disabled':'')+'>Approve this print pack</button></form>':'<div class="hint">Waiting for Veelad to approve the supplier-specific print pack.</div>')+
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


async function loadOperations(){
 if(!state.session?.admin&&!state.activeSupplier){state.ops={jobs:[]};state.alerts={notifications:[],unread:0};return;}
 const params=state.activeSupplier?{supplier_id:state.activeSupplier}:{};
 const [ops,alerts]=await Promise.all([api('fulfillment-operations',{params}),api('fulfillment-notifications')]);
 state.ops=ops;state.alerts=alerts;
}
async function loadPhase2(id){
 const [packing,messages,shipping]=await Promise.all([
  api('fulfillment-packaging-signoff',{params:{order_id:id}}),
  api('fulfillment-messages',{params:{order_id:id}}),
  api('fulfillment-shipping-events',{params:{order_id:id}})
 ]);
 state.phase2={packing,messages:messages.messages||[],self_id:messages.self_id,shipping};
}
async function loadAdminOperations(){
 const id=state.activeSupplier||state.session.suppliers?.find(s=>s.status==='active')?.id;
 if(!id){state.adminOps={id:null,rules:[],policy:null};return;}
 const [pack,sla]=await Promise.all([api('admin-fulfillment-packaging',{params:{supplier_id:id}}),api('admin-fulfillment-sla',{params:{supplier_id:id}})]);
 state.adminOps={id,rules:pack.rules||[],policy:sla.policy};
}
function overviewOps(){
 const overdue=(state.ops.jobs||[]).filter(x=>x.deadline?.overdue);
 const approaching=(state.ops.jobs||[]).filter(x=>x.deadline?.due_soon);
 const count=state.alerts.unread||0;
 return '<div class="metrics" style="margin-top:20px">'+metric('Overdue milestones',overdue.length,'◷','Based on configured supplier deadlines')+metric('Due within 6 hours',approaching.length,'◴','Upcoming supplier deadlines')+metric('Unread operations alerts',count,'◉','Private alerts for your account')+'</div>'+
 (overdue.length?'<section class="card"><div class="card-title"><h2>Milestones needing attention</h2><button type="button" class="text-link" data-view="bulk">Manage queue →</button></div><div class="ops-list">'+overdue.slice(0,8).map(x=>'<button type="button" class="ops-row" data-open="'+escapeHTML(x.order_id)+'"><strong>'+escapeHTML(x.order_id)+'</strong><span>'+escapeHTML(x.deadline.label)+'</span><span class="due-over">Overdue · '+fmt(x.deadline.due_at)+'</span></button>').join('')+'</div></section>':'');
}
function packagingDesk(){
 const items=state.jobs.filter(x=>['quality_check','packed','dispatch_submitted'].includes(x.status));
 return '<section class="card"><div class="card-title"><h2>Packaging operations</h2><span class="pill-note">Veelad brand only · #9B81EF</span></div><p class="section-subtitle">Check the approved supplier packaging instructions on each order. Record mandatory packing checks and approved photos before marking the order packed. Use the internal picking sheet — it is not a carrier label.</p>'+jobTable(items)+'</section>'+
 (state.session.admin?adminPhaseTwoPanel():'<div class="hint">Packaging templates are set by Veelad administrators. Use the order page to inspect your assigned requirements.</div>');
}
function notificationsView(){
 const a=state.alerts.notifications||[];
 return '<section class="card"><div class="card-title"><h2>Notifications</h2><span class="pill-note">'+Number(state.alerts.unread||0)+' unread</span></div>'+
 (a.length?'<div class="ops-list">'+a.map(x=>'<div class="ops-alert '+(!x.read_at?'unread':'')+'"><div><strong>'+escapeHTML(x.kind.replaceAll('_',' '))+'</strong><p>'+escapeHTML(x.message)+'</p><small>'+fmt(x.created_at)+' · '+escapeHTML(x.order_id)+'</small></div><div class="actions"><button type="button" class="button secondary" data-open="'+escapeHTML(x.order_id)+'">Open</button>'+(!x.read_at?'<button type="button" class="button secondary" data-alert-read="'+escapeHTML(x.id)+'">Mark read</button>':'')+'</div></div>').join('')+'</div>':empty('No alerts','Assigned jobs and fulfillment updates will generate private in-app notifications.'))+'</section>';
}
function messagesView(){
 return '<section class="card"><div class="card-title"><h2>Supplier order conversations</h2></div><p class="section-subtitle">Open an assigned order to send a private message or attach a JPEG/PNG image. Messages are visible only to Veelad administrators and authorized employees of the assigned supplier.</p>'+jobTable(state.jobs)+'</section>';
}
function bulkView(){
 if(!state.activeSupplier)return '<section class="card">'+empty('Choose one supplier','Select a supplier using the menu above to accept jobs in bulk or export its picking list.')+'</section>';
 const ready=state.jobs.filter(x=>x.supplier_id===state.activeSupplier&&x.status==='assigned');
 return '<section class="card"><div class="card-title"><h2>Batch acceptance</h2><span class="pill-note">Up to 20 jobs per operation</span></div><p class="section-subtitle">Each job is checked again on the server for verified payment, current approval, permissions and revision. All selected jobs succeed together or none changes.</p>'+
 (ready.length?'<div class="table-scroll"><table class="data-table"><thead><tr><th><input type="checkbox" id="bulk-all" aria-label="Select all displayed jobs"></th><th>Order</th><th>Items</th><th>Revision</th></tr></thead><tbody>'+
 ready.slice(0,20).map(j=>'<tr><td><input type="checkbox" data-bulk-job="'+escapeHTML(j.id)+'" aria-label="Select '+escapeHTML(j.id)+'"></td><td>'+escapeHTML(j.id)+'</td><td>'+j.items.length+'</td><td>'+j.revision+'</td></tr>').join('')+'</tbody></table></div><div class="actions" style="margin-top:18px"><button class="button accent" type="button" data-bulk-accept="1">Accept selected jobs</button></div>':empty('No orders awaiting acceptance','Approved new orders assigned to this supplier appear here.'))+'</section>'+
 '<section class="card"><div class="card-title"><h2>Export picking list</h2></div><p class="section-subtitle">CSV includes assigned order IDs, products, variants and quantities only — never customer payment information, artist earnings or shipping addresses.</p><a class="button secondary" download href="'+escapeHTML(urlFor('fulfillment-picklist',{supplier_id:state.activeSupplier}))+'">↓ Download supplier picking list</a></section>';
}
function deadlinePanel(){
 const j=state.selected?.job,ops=state.ops.jobs?.find(x=>x.order_id===j?.id);
 if(!j)return '';
 const d=ops?.deadline;
 return '<section class="card"><div class="card-title"><h2>Operational deadlines</h2>'+(d?.overdue?'<span class="status on_hold">Overdue</span>':'')+'</div>'+
 (ops?.accept_by?'<dl><div class="value-block"><dt>Accept by</dt><dd>'+fmt(ops.accept_by)+'</dd></div><div class="value-block"><dt>Production by</dt><dd>'+fmt(ops.production_by)+'</dd></div><div class="value-block"><dt>Dispatch by</dt><dd>'+fmt(ops.dispatch_by)+'</dd></div></dl>':'<div class="hint">No supplier SLA has been set for this order. Veelad will not invent production deadlines.</div>')+
 (state.session.admin?'<details class="detail-expander"><summary>Adjust this order’s deadlines</summary><form data-form="deadline"><div class="field"><label for="deadline-accept">Acceptance deadline (local)</label><input id="deadline-accept" name="accept_by" type="datetime-local" required></div><div class="field"><label for="deadline-production">Production deadline (local)</label><input id="deadline-production" name="production_by" type="datetime-local" required></div><div class="field"><label for="deadline-dispatch">Dispatch deadline (local)</label><input id="deadline-dispatch" name="dispatch_by" type="datetime-local" required></div><button class="button accent" type="submit">Save deadlines</button></form></details>':'')+'</section>';
}
function packingPanel(){
 const p=state.phase2?.packing,job=state.selected?.job;
 if(!p||!job)return '';
 const member=state.session.suppliers.find(x=>x.id===job.supplier_id);
 const reviewer=state.session.admin||['quality','manager'].includes(member?.supplier_role);
 const fields=[['garments','Garments and sizes verified'],['artwork','Printed design and QC approved'],['branding','Veelad-only exterior branding'],['insert','Required inserts added'],['address','Delivery address and recipient verified'],['sealed','Package securely sealed']];
 return '<section class="card"><div class="card-title"><div><h2>Packaging & handoff</h2><p>Versioned brand requirements, checked per assigned order.</p></div>'+status(p.signoff?'approved':p.missing.length?'on_hold':'awaiting_approval')+'</div>'+
 (p.missing.length?'<div class="notice error">Missing approved supplier packaging rules: '+escapeHTML(p.missing.join(', '))+'</div>':'')+
 (p.rules.length?'<div class="packing-rules">'+p.rules.map(r=>'<div class="item-card"><h3>'+escapeHTML(r.category)+' · '+escapeHTML(r.container)+'</h3><p>'+escapeHTML(r.instructions)+'</p><p class="form-help">Inserts: '+escapeHTML(r.inserts.join(', ')||'None')+' · '+(r.require_photo?'Approved packaging photo required':'Photo optional')+' · Policy v'+Number(r.revision)+'</p></div>').join('')+'</div>':'')+
 '<div class="actions"><a class="button secondary" target="_blank" rel="noopener noreferrer" href="'+escapeHTML(urlFor('fulfillment-packing-slip',{order_id:job.id}))+'">View internal picking sheet</a></div>'+
 (p.signoff?'<p class="good-copy">Packaging sign-off recorded · '+fmt(p.signoff.checked_at)+'</p>':
 reviewer&&job.status==='quality_check'&&!p.missing.length?'<form data-form="packing-signoff" class="packing-checklist">'+fields.map(([id,label])=>'<label class="checkline"><input type="checkbox" name="'+id+'" required> '+escapeHTML(label)+'</label>').join('')+'<button class="button accent" type="submit">Approve packaging checklist</button></form>':'<p class="section-subtitle" style="margin-top:16px">Packaging approval requires the quality-control stage and an authorized reviewer.</p>')+
 deadlinePanel()+'</section>';
}
function conversationPanel(){
 const data=state.phase2,j=state.selected?.job;
 if(!data||!j)return '';
 return '<section class="card"><div class="card-title"><div><h2>Order conversation</h2><p>Private supplier-to-Veelad communication, with an audit trail.</p></div></div>'+
 '<div class="message-thread">'+(data.messages.length?data.messages.map(m=>'<div class="message-bubble '+(m.author_id===data.self_id?'mine':'')+'"><strong>'+(m.author_id===data.self_id?'You':'Team member')+'</strong><p>'+escapeHTML(m.body)+'</p>'+(m.attachment_id?'<a target="_blank" rel="noopener noreferrer" href="'+escapeHTML(urlFor('fulfillment-message-file',{order_id:j.id,message_id:m.id}))+'">View private photo attachment</a>':'')+'<small>'+fmt(m.created_at)+'</small></div>').join(''):empty('No messages yet','Use this thread to discuss print specifications, defects, materials or handoff.'))+'</div>'+
 '<form data-form="message" class="message-form"><label class="field"><span>New message</span><textarea name="message" maxlength="2000" minlength="2" placeholder="Ask a question or leave an operational update…" required></textarea></label><label class="field"><span>Optional photo (JPEG or PNG, up to 8 MB)</span><input type="file" name="photo" accept="image/png,image/jpeg"></label><button class="button accent" type="submit">Send private message</button></form></section>';
}
function shippingEventsPanel(){
 const d=state.phase2?.shipping,j=state.selected?.job;
 if(!d||!j)return '';
 const allowed=['packed','dispatch_submitted'].includes(j.status)||d.order_status==='shipped';
 return '<section class="card"><div class="card-title"><h2>Shipping handoff & exceptions</h2></div><p class="section-subtitle">Manual carrier event log. Recording an event never purchases a shipping label, confirms delivery, or changes the customer order status.</p>'+
 (d.carrier?'<p><strong>Carrier:</strong> '+escapeHTML(d.carrier)+' · <strong>Tracking:</strong> '+escapeHTML(d.tracking||'Pending')+'</p>':'<p class="form-help">Submit carrier and tracking information in the Production panel after packing.</p>')+
 (allowed?'<form data-form="shipping-event"><label class="field"><span>Carrier event</span><select name="event_type"><option value="courier_handoff">Courier handoff</option><option value="delivery_exception">Shipping exception</option><option value="delivery_update">Delivery update (manual)</option></select></label><label class="field"><span>Event details</span><textarea name="notes" maxlength="1000" minlength="8" required placeholder="Describe the verified carrier event or delivery issue."></textarea></label><button class="button secondary" type="submit">Record shipping event</button></form>':'<div class="hint">Carrier events unlock once the package is ready for dispatch.</div>')+
 (d.events?.length?'<div class="ops-list">'+d.events.map(e=>'<div class="ops-alert"><div><strong>'+escapeHTML(e.event_type.replaceAll('_',' '))+'</strong><p>'+escapeHTML(e.notes)+'</p><small>'+fmt(e.created_at)+'</small></div></div>').join('')+'</div>':'')+'</section>';
}
function adminPhaseTwoPanel(){
 if(!state.session.admin)return '';
 const id=state.adminOps.id;
 if(!id)return '<section class="card">'+empty('Add a supplier first','Manufacturing policies are configured per supplier company.')+'</section>';
 const opts=state.session.suppliers.filter(x=>x.status==='active').map(x=>'<option value="'+escapeHTML(x.id)+'" '+(x.id===id?'selected':'')+'>'+escapeHTML(x.name)+'</option>').join('');
 const policy=state.adminOps.policy;
 return '<div class="two-col"><section class="card"><div class="card-title"><div><h2>Veelad packaging manual</h2><p>Define factory-confirmed instructions for each category.</p></div></div><form data-form="packaging-policy"><label class="field"><span>Supplier</span><select name="supplier_id" required>'+opts+'</select></label><label class="field"><span>Exact product category</span><input name="category" maxlength="60" placeholder="T-shirts" required></label><label class="field"><span>Packaging container</span><select name="container"><option value="mailer">Mailer</option><option value="box">Box</option><option value="tube">Tube</option><option value="other">Other</option></select></label><label class="field"><span>Packaging instructions</span><textarea name="instructions" minlength="20" maxlength="2000" required placeholder="Use Veelad branding only. Specify tissue paper, garment folding and protection requirements…"></textarea></label><label class="field"><span>Inserts (comma-separated)</span><input name="inserts" placeholder="Thank you card, care instructions"></label><label class="checkline"><input name="require_photo" type="checkbox" checked> Require independently approved packaging photographs</label><button type="submit" class="button accent">Save versioned packaging rule</button></form>'+
 (state.adminOps.rules.length?'<div class="ops-list">'+state.adminOps.rules.map(r=>'<div class="ops-alert"><strong>'+escapeHTML(r.category)+'</strong><span>'+escapeHTML(r.container)+' · v'+Number(r.revision)+'</span><p>'+escapeHTML(r.instructions)+'</p></div>').join('')+'</div>':'<p class="form-help">No rules saved yet. Unspecified categories cannot be marked packed.</p>')+'</section>'+
 '<section class="card"><div class="card-title"><div><h2>Supplier service-level targets</h2><p>Targets are measured from initial job assignment.</p></div></div><form data-form="sla"><label class="field"><span>Supplier company</span><select name="supplier_id">'+opts+'</select></label><label class="field"><span>Acceptance deadline (hours)</span><input type="number" name="accept_hours" min="1" max="168" value="'+Number(policy?.accept_hours||24)+'" required></label><label class="field"><span>Production deadline (hours from assignment)</span><input type="number" name="production_hours" min="1" max="720" value="'+Number(policy?.production_hours||72)+'" required></label><label class="field"><span>Dispatch deadline (hours from assignment)</span><input type="number" name="dispatch_hours" min="1" max="1440" value="'+Number(policy?.dispatch_hours||120)+'" required></label><button class="button accent" type="submit">Save SLA targets</button></form><p class="form-help">Existing jobs keep their recorded deadlines unless an administrator edits them. No deadlines are invented for suppliers without saved targets.</p>'+
 (policy?'<div class="hint">Current policy: '+Number(policy.accept_hours)+'h acceptance · '+Number(policy.production_hours)+'h production · '+Number(policy.dispatch_hours)+'h dispatch</div>':'<div class="hint">No supplier SLA policy is active yet.</div>')+'</section></div>';
}


async function loadPhase3(){
 const p=state.phase3,supplier=state.activeSupplier,params=supplier?{supplier_id:supplier}:{};
 if(!state.session.admin&&!supplier){p.jobs=[];p.analytics=[];p.invoices=[];return;}
 const requests=[
  api('fulfillment-line-jobs',{params}),
  api('fulfillment-supplier-analytics',{params}),
  state.session.admin?api('admin-fulfillment-route-options'):Promise.resolve({orders:[],suppliers:[]}),
  api('fulfillment-invoices',{params}).catch(error=>({invoices:[],error:error.message})),
  state.session.admin&&supplier?api('admin-fulfillment-keys',{params:{supplier_id:supplier}}):Promise.resolve({keys:[]})
 ];
 const [jobs,analytics,candidates,invoices,keys]=await Promise.all(requests);
 p.jobs=jobs.jobs||[];p.analytics=analytics.suppliers||[];p.candidates=candidates;
 p.invoices=invoices.invoices||[];p.keys=keys.keys||[];
 if(!p.routeOrder||!candidates.orders?.some(x=>x.order_id===p.routeOrder))p.routeOrder=candidates.orders?.[0]?.order_id||null;
 if(p.selected){try{p.selected=await api('fulfillment-line-job',{params:{line_job_id:p.selected.job.id}});}catch{p.selected=null;}}
}
function splitJobsView(){
 const jobs=state.phase3.jobs;
 return '<div class="metrics">'+metric('Individual supplier lines',jobs.length,'◈','Each supplier can access its own purchased items')+
 metric('Awaiting acceptance',jobs.filter(x=>x.status==='assigned').length,'◷')+
 metric('In manufacture',jobs.filter(x=>['accepted','printing','quality_check'].includes(x.status)).length,'⚙')+
 metric('Dispatched lines',jobs.filter(x=>x.status==='dispatched').length,'✓')+'</div>'+
 '<section class="card"><div class="card-title"><div><h2>Assigned product lines</h2><p>Individual product assignments within split customer orders.</p></div></div>'+
 (jobs.length?'<div class="table-scroll"><table class="data-table"><thead><tr><th>Order / line</th><th>Product</th><th>Supplier</th><th>Stage</th><th></th></tr></thead><tbody>'+
 jobs.map(j=>'<tr><td><strong>'+escapeHTML(j.order_id)+'</strong><small class="row-subtitle">'+escapeHTML(j.line_id)+'</small></td><td>'+escapeHTML(j.product.title)+'<small class="row-subtitle">'+escapeHTML(j.product.variant)+' × '+Number(j.product.qty)+'</small></td><td>'+escapeHTML(j.supplier_id)+'</td><td>'+status(j.status)+'</td><td><button type="button" class="button secondary" data-line-open="'+escapeHTML(j.id)+'">Open line</button></td></tr>').join('')+'</tbody></table></div>':empty('No split manufacturing jobs','Veelad administrators can assign different purchased product lines to separate suppliers using Route by product.'))+'</section>';
}
function splitRoutingView(){
 if(!state.session.admin)return empty('Admin-only routing','Only Veelad can assign purchased lines to different suppliers.');
 const p=state.phase3,orders=p.candidates.orders||[],suppliers=p.candidates.suppliers||[],selected=orders.find(x=>x.order_id===p.routeOrder);
 if(!orders.length)return '<section class="card">'+empty('No orders eligible for split routing','A customer order needs verified payment, approved final proofs, at least two purchased product lines, and no prior supplier assignment.')+'</section>';
 return '<section class="card"><div class="card-title"><div><h2>Multi-supplier routing</h2><p>Every purchased product line must be assigned exactly once. This cannot overwrite an existing single-supplier job.</p></div></div>'+
 '<div class="hint">Configure verified printing specifications for the selected categories on each supplier before assigning. Approval and QC are then required separately for every supplier line.</div>'+
 '<label class="field"><span>Eligible production order</span><select id="route-order-picker">'+orders.map(o=>'<option value="'+escapeHTML(o.order_id)+'" '+(o.order_id===p.routeOrder?'selected':'')+'>'+escapeHTML(o.order_id)+' · '+o.items.length+' product lines</option>').join('')+'</select></label>'+
 (selected?'<form data-form="split-route"><div class="table-scroll"><table class="data-table"><thead><tr><th>Purchased line</th><th>Product</th><th>Manufacturing supplier</th></tr></thead><tbody>'+
 selected.items.map(item=>'<tr><td class="mono">'+escapeHTML(item.line_id)+'</td><td>'+escapeHTML(item.title)+' · '+escapeHTML(item.variant)+' × '+Number(item.qty)+'</td><td><select data-route-line="'+escapeHTML(item.line_id)+'" required><option value="">Choose supplier</option>'+suppliers.map(x=>'<option value="'+escapeHTML(x.id)+'">'+escapeHTML(x.name)+'</option>').join('')+'</select></td></tr>').join('')+'</tbody></table></div>'+
 '<button type="submit" class="button accent" '+(suppliers.length<2?'disabled':'')+'>Assign lines to manufacturing suppliers</button></form>':'')+'</section>';
}
function splitAnalyticsView(){
 const stats=state.phase3.analytics;
 return '<section class="card"><div class="card-title"><div><h2>Supplier performance scorecards</h2><p>Operational metrics only — no customer prices, royalty data or factory settlements.</p></div></div>'+
 (stats.length?'<div class="table-scroll"><table class="data-table"><thead><tr><th>Supplier</th><th>Jobs</th><th>Completion</th><th>On-time*</th><th>Defect-affected lines</th><th>Avg. hours</th></tr></thead><tbody>'+
 stats.map(x=>'<tr><td><strong>'+escapeHTML(x.name)+'</strong></td><td>'+Number(x.total_jobs)+'</td><td>'+Number(x.completion_rate)+'%</td><td>'+Number(x.on_time_rate)+'% <small>('+Number(x.measured_shipments)+' measured)</small></td><td>'+Number(x.defect_affected_lines)+' / '+Number(x.split_lines)+'</td><td>'+(x.average_production_hours===null?'—':Number(x.average_production_hours))+'</td></tr>').join('')+'</tbody></table></div>':empty('No supplier production data yet','Assigned and completed jobs will appear in the analytics once orders enter manufacturing.'))+
 '<p class="form-help">*On-time shipping is calculated only when an order has a stored dispatch deadline. No deadline is assumed. Direct legacy jobs are counted, but detailed time measurements are available for split product lines.</p></section>'+
 (state.session.admin?'<section class="card"><div class="card-title"><h2>Deadline monitoring</h2></div><p>Run a bounded, idempotent check for deadlines approaching within six hours or already overdue. Hostinger cron can later run the same checker automatically.</p><button type="button" class="button secondary" data-sla-sweep="1">Check supplier deadlines now</button></section>':'');
}
function splitInvoicesView(){
 const p=state.phase3,invoice=p.invoice,available=p.jobs.filter(j=>j.status==='dispatched');
 const supplier=p.invoiceSupplier||state.activeSupplier||state.session.suppliers?.find(x=>x.status==='active')?.id||null;
 const options=(state.session.suppliers||[]).filter(x=>x.status==='active').map(x=>'<option value="'+escapeHTML(x.id)+'" '+(x.id===supplier?'selected':'')+'>'+escapeHTML(x.name)+'</option>').join('');
 const rows=available.filter(x=>x.supplier_id===supplier);
 const invoiceList='<section class="card"><div class="card-title"><div><h2>Manufacturing invoices</h2><p>Manufacturing charges are separate from customer retail payments and artist earnings.</p></div></div>'+
 (p.invoices.length?'<div class="table-scroll"><table class="data-table"><thead><tr><th>Invoice</th><th>Supplier</th><th>Status</th><th>Currency</th><th></th></tr></thead><tbody>'+
 p.invoices.map(x=>'<tr><td>'+escapeHTML(x.invoice_number)+'</td><td>'+escapeHTML(x.supplier_id)+'</td><td>'+status(x.status)+'</td><td>'+escapeHTML(x.currency)+'</td><td><button type="button" class="button secondary" data-invoice-open="'+escapeHTML(x.id)+'">Details</button></td></tr>').join('')+'</tbody></table></div>':empty('No manufacturing invoices','Veelad can create a factory-cost invoice after manufacturing lines have been dispatched.'))+'</section>';
 const details=invoice?'<section class="card"><div class="card-title"><h2>'+escapeHTML(invoice.invoice_number)+'</h2>'+status(invoice.status)+'</div>'+
 '<p>Currency: '+escapeHTML(invoice.currency)+' · Supplier: '+escapeHTML(invoice.supplier_id)+'</p>'+
 '<div class="table-scroll"><table class="data-table"><thead><tr><th>Line job</th><th>Units</th><th>Cost / unit (minor)</th><th>Tax (minor)</th></tr></thead><tbody>'+invoice.lines.map(x=>'<tr><td>'+escapeHTML(x.line_job_id)+'</td><td>'+Number(x.quantity)+'</td><td>'+Number(x.unit_cost_minor)+'</td><td>'+Number(x.tax_minor)+'</td></tr>').join('')+'</tbody></table></div>'+
 '<p class="form-help">Manufacturing total: <strong>'+Number(invoice.total_minor)+' '+escapeHTML(invoice.currency)+' minor units</strong> (subtotal '+Number(invoice.subtotal_minor)+', tax '+Number(invoice.tax_minor)+').</p>'+
 '<div class="actions">'+(invoice.status==='draft'?'<button type="button" class="button accent" data-invoice-action="submit">Submit invoice for review</button>':'')+
 (state.session.admin&&invoice.status==='submitted'?'<button type="button" class="button accent" data-invoice-action="approve">Approve manufacturing invoice</button>':'')+
 (state.session.admin&&invoice.status==='approved'?'<button type="button" class="button secondary" data-invoice-action="record_paid">Record externally verified bank settlement</button>':'')+'</div><p class="form-help">This portal never transfers money or initiates bank payments. Settlement status is only recorded after an external payment reference is supplied.</p></section>':'';
 const create=state.session.admin?'<section class="card"><div class="card-title"><h2>Create factory-cost invoice</h2></div><form data-form="split-invoice"><label class="field"><span>Supplier</span><select id="invoice-supplier-picker" name="supplier_id">'+options+'</select></label><label class="field"><span>Invoice number</span><input name="invoice_number" maxlength="80" placeholder="ML-2026-0001" required></label><label class="field"><span>Currency</span><select name="currency">'+['SAR','AED','BHD','KWD','OMR','QAR','EUR','USD','GBP'].map(x=>'<option value="'+x+'">'+x+'</option>').join('')+'</select></label><label class="field"><span>Internal note (optional)</span><textarea name="note" maxlength="1000"></textarea></label>'+
 (rows.length?'<div class="table-scroll"><table class="data-table"><thead><tr><th>Include</th><th>Line / units</th><th>Unit cost (minor units)</th><th>Tax (minor units)</th></tr></thead><tbody>'+
 rows.map(x=>'<tr><td><input type="checkbox" data-invoice-line="'+escapeHTML(x.id)+'"></td><td>'+escapeHTML(x.product.title)+' · '+Number(x.product.qty)+'</td><td><input type="number" data-invoice-cost="'+escapeHTML(x.id)+'" min="1" max="100000000" value="100" style="width:120px"></td><td><input type="number" data-invoice-tax="'+escapeHTML(x.id)+'" min="0" max="100000000" value="0" style="width:120px"></td></tr>').join('')+'</tbody></table></div>':'<div class="hint">No completed split product lines are available for this supplier.</div>')+
 '<button type="submit" class="button accent" '+(!rows.length?'disabled':'')+'>Create draft invoice</button></form></section>':'';
 return invoiceList+details+create;
}
function splitIntegrationView(){
 if(!state.session.admin)return empty('Administrator access required','Only Veelad may create supplier API credentials.');
 const p=state.phase3,supplier=state.activeSupplier||state.session.suppliers?.find(x=>x.status==='active')?.id;
 if(!supplier)return '<section class="card">'+empty('Choose a supplier','Select an active supplier company to manage API credentials.')+'</section>';
 return '<section class="card"><div class="card-title"><h2>Partner integration credentials</h2><span class="pill-note">90-day expiry</span></div><p class="section-subtitle">API access is limited to the selected supplier. No API token can download private artwork, customer addresses, invoices or artist earnings.</p>'+
 '<form data-form="split-api-key"><input type="hidden" name="supplier_id" value="'+escapeHTML(supplier)+'"><label class="field"><span>Integration description</span><input name="label" maxlength="100" required placeholder="Merchlist staging order intake"></label>'+
 '<label class="field"><span>Permissions</span><select name="scope"><option value="read">Read assigned production lines</option><option value="status">Read and submit limited production status updates</option></select></label><button class="button accent" type="submit">Create 90-day API credential</button></form>'+
 (p.lastToken?'<div class="hint"><p><strong>New credential — copy this once</strong></p><code class="api-token">'+escapeHTML(p.lastToken)+'</code><div class="actions"><button type="button" class="button secondary" data-copy-api-token="1">Copy secret</button><button type="button" class="button secondary" data-dismiss-api-token="1">Hide secret</button></div></div>':'')+
 (p.keys.length?'<div class="table-scroll"><table class="data-table"><thead><tr><th>Label</th><th>Access</th><th>Expires</th><th>Status</th><th></th></tr></thead><tbody>'+
 p.keys.map(k=>'<tr><td>'+escapeHTML(k.label)+'</td><td>'+escapeHTML(k.scope)+'</td><td>'+fmt(k.expires_at)+'</td><td>'+status(k.revoked_at?'suspended':Date.parse(k.expires_at)<Date.now()?'expired':'active')+'</td><td>'+(!k.revoked_at?'<button type="button" class="button secondary" data-api-key-revoke="'+escapeHTML(k.id)+'">Revoke</button>':'')+'</td></tr>').join('')+'</tbody></table></div>':'<p class="form-help">No active external integrations have been authorized.</p>')+'</section>'+
 '<section class="card"><div class="card-title"><h2>Supplier API v1</h2></div><p>Authentication: <code>Authorization: Bearer YOUR_TOKEN</code> (never in URLs). Methods:</p><pre class="api-example">GET /api/fulfillment/v1/jobs\nGET /api/fulfillment/v1/jobs/{line_job_id}\nPOST /api/fulfillment/v1/jobs/{line_job_id}/status\n{"revision": 0, "action": "accepted"}</pre><p class="form-help">Every mutation requires the latest revision; available API actions are acceptance, printing and quality-check only. Packing, photos, dispatch, invoices and external payment operations remain human-authorized.</p></section>';
}
function splitDetailView(){
 const p=state.phase3.selected;if(!p)return '';
 const j=p.job,x=p.product,role=state.session.admin?'admin':state.session.suppliers.find(s=>s.id===j.supplier_id)?.supplier_role||'';
 const canOperate=state.session.admin||role==='manager'||role==='production',canQuality=state.session.admin||role==='manager'||role==='quality';
 const next={assigned:['accepted','Accept production line'],accepted:['printing','Begin printing'],printing:['quality_check','Move to quality inspection'],quality_check:['packed','Confirm packed & QC complete']}[j.status];
 const files=p.preflight.approved?'<a class="button secondary" download href="'+escapeHTML(urlFor('fulfillment-line-files',{line_job_id:j.id}))+'">↓ Download certified-source production pack</a>':'<p class="hint">Production files are locked until Veelad approves a current per-line print report.</p>';
 return '<div class="actions" style="margin-bottom:18px"><button type="button" class="button secondary" data-view="split">← Assigned product lines</button><span class="pill-note">'+escapeHTML(j.order_id)+' / '+escapeHTML(j.line_id)+'</span>'+status(j.status)+'</div>'+
 '<div class="metrics">'+metric('Product',escapeHTML(x.title),'▧')+metric('Units',Number(x.qty),'◫')+metric('Supplier',escapeHTML(j.supplier_id),'◈')+metric('Revision',Number(j.revision),'↻')+'</div>'+
 '<div class="two-col"><div>'+
 '<section class="card"><div class="card-title"><h2>Production progression</h2>'+status(j.status)+'</div>'+
 (next&&(canOperate&&next[0]!=='packed'||canQuality&&next[0]==='packed')?'<button type="button" class="button accent" data-line-progress="'+next[0]+'">'+next[1]+'</button>':'')+
 (j.status==='on_hold'?'<p class="hint">Resolve all open manufacturing issues, then resume the previous stage.</p><button type="button" class="button secondary" data-line-progress="resume">Resume production</button>':'')+
 (['assigned','accepted','printing','quality_check','packed'].includes(j.status)&&canOperate?'<details class="detail-expander"><summary>Report a production hold</summary><form data-form="line-issue"><label class="field"><span>Reason and corrective action required</span><textarea name="note" minlength="10" maxlength="1000" required></textarea></label><button class="button secondary" type="submit">Place line on hold</button></form></details>':'')+
 (j.status==='packed'&&canOperate?'<form data-form="line-dispatch"><label class="field"><span>Carrier</span><input name="carrier" maxlength="100" required></label><label class="field"><span>Tracking number</span><input name="tracking" maxlength="120" required></label><button type="submit" class="button accent">Submit line dispatch for Veelad approval</button></form>':'')+
 (j.status==='dispatch_submitted'&&state.session.admin?'<button type="button" class="button accent" data-line-dispatch="'+escapeHTML(j.id)+'">Approve supplier dispatch</button>':'')+
 (j.status==='dispatched'?'<p class="good-copy">Veelad approved the dispatch of this purchased product line.</p>':'')+'</section>'+
 '<section class="card"><div class="card-title"><h2>Per-line print certification</h2>'+status(p.preflight.approved?'approved':p.preflight.report.blocks.length?'on_hold':'awaiting_approval')+'</div>'+
 (p.preflight.report.blocks.length?'<ul class="audit-list">'+p.preflight.report.blocks.map(b=>'<li class="critical-item">'+escapeHTML(b)+'</li>').join('')+'</ul>':'<p class="good-copy">No automatic print metadata blockers.</p>')+
 (p.preflight.report.warnings||[]).map(w=>'<p class="form-help">'+escapeHTML(w)+'</p>').join('')+
 (state.session.admin&&!p.preflight.approved&&['assigned','accepted'].includes(j.status)&&!p.preflight.report.blocks.length?'<form data-form="line-preflight"><label class="field"><span>Document equipment, colour, placement and physical proof review</span><textarea name="review_note" minlength="15" maxlength="1000" required></textarea></label><label class="checkline"><input type="checkbox" name="confirm" required> I verified the factory print template and approved proof</label><button type="submit" class="button accent">Approve line print specifications</button></form>':'')+files+'</section>'+
 '<section class="card"><div class="card-title"><h2>Inspection photographs</h2></div>'+
 (['printing','quality_check','on_hold'].includes(j.status)?'<form data-form="line-photo"><label class="field"><span>Inspection photo category</span><select name="kind"><option value="final_print">Final print</option><option value="packaging">Finished packaging</option></select></label><label class="field"><span>PNG or JPEG (max 8 MB)</span><input type="file" name="photo" accept="image/png,image/jpeg" required></label><button type="submit" class="button secondary">Submit inspection photograph</button></form>':'')+
 (p.evidence.length?'<div class="ops-list">'+p.evidence.map(e=>'<div class="ops-alert"><div><strong>'+escapeHTML(e.kind.replaceAll('_',' '))+'</strong><p>'+escapeHTML(e.status)+' · '+fmt(e.created_at)+'</p><a target="_blank" rel="noopener noreferrer" href="'+escapeHTML(urlFor('fulfillment-line-evidence-file',{line_job_id:j.id,evidence_id:e.id}))+'">View private photograph</a></div>'+
 (e.status==='pending'&&canQuality?'<div class="actions"><button class="button secondary" type="button" data-line-review="'+escapeHTML(e.id)+'" data-line-decision="approved">Approve</button><button type="button" class="button secondary" data-line-review="'+escapeHTML(e.id)+'" data-line-decision="rejected">Reject</button></div>':'')+'</div>').join('')+'</div>':'<p class="form-help">Inspection evidence is private and requires independent quality review.</p>')+'</section>'+
 '<section class="card"><div class="card-title"><h2>Manufacturing issues</h2></div>'+
 (p.issues.length?'<div class="ops-list">'+p.issues.map(i=>'<div class="ops-alert"><div><strong>'+escapeHTML(i.status)+'</strong><p>'+escapeHTML(i.note)+'</p>'+(i.resolution?'<p>Resolved: '+escapeHTML(i.resolution)+'</p>':'')+'</div>'+
 (i.status==='open'&&canQuality?'<button type="button" class="button secondary" data-line-resolve="'+escapeHTML(i.id)+'">Resolve</button>':'')+'</div>').join('')+'</div>':'<p class="good-copy">No open manufacturing issues reported.</p>')+'</section>'+
 '</div><div>'+
 '<section class="card"><div class="card-title"><h2>Supplier packaging</h2>'+status(p.packing.approved?'approved':'awaiting_approval')+'</div>'+
 (p.packing.rule?'<p><strong>'+escapeHTML(p.packing.rule.container)+'</strong> · '+escapeHTML(p.packing.rule.category)+'</p><p>'+escapeHTML(p.packing.rule.instructions)+'</p><p class="form-help">Inserts: '+escapeHTML(p.packing.rule.inserts.join(', ')||'None')+' · '+(p.packing.rule.require_photo?'QC-approved package photograph required':'Photo optional')+'</p>':'<p class="hint">Veelad has not configured the supplier packaging rule for this product.</p>')+
 (j.status==='quality_check'&&!p.packing.approved&&canQuality&&p.packing.rule?'<form data-form="line-packing">'+[['garments','Garment and size match order'],['artwork','Print and placement approved'],['branding','Veelad-only branding'],['insert','Required inserts present'],['address','Shipping address checked'],['sealed','Package securely sealed']].map(([key,label])=>'<label class="checkline"><input type="checkbox" name="'+key+'" required> '+label+'</label>').join('')+'<button type="submit" class="button accent">Approve line packaging</button></form>':'')+'</section>'+
 '<section class="card"><div class="card-title"><h2>Delivery handoff</h2></div>'+
 (p.shipping?'<dl>'+Object.entries(p.shipping).filter(([,v])=>v).map(([key,value])=>'<div class="value-block"><dt>'+escapeHTML(key)+'</dt><dd>'+escapeHTML(value)+'</dd></div>').join('')+'</dl>':'<div class="hint">Customer delivery details remain restricted until this supplier’s product is packed.</div>')+
 (j.tracking?'<p><strong>'+escapeHTML(j.carrier)+'</strong> · '+escapeHTML(j.tracking)+'</p>':'')+
 (p.deadlines?'<div class="value-block"><dt>Production deadline</dt><dd>'+fmt(p.deadlines.production_by)+'</dd></div><div class="value-block"><dt>Dispatch deadline</dt><dd>'+fmt(p.deadlines.dispatch_by)+'</dd></div>':'')+'</section>'+
 '<section class="card"><div class="card-title"><h2>Product-line conversation</h2></div>'+
 '<div class="message-thread">'+(p.messages.length?p.messages.map(m=>'<div class="message-bubble '+(m.author_id===p.self_id?'mine':'')+'"><strong>'+(m.author_id===p.self_id?'You':'Supplier team')+'</strong><p>'+escapeHTML(m.body)+'</p><small>'+fmt(m.created_at)+'</small></div>').join(''):empty('No messages','Messages in split orders are isolated by supplier and product line.'))+'</div>'+
 '<form data-form="line-message"><label class="field"><span>Private production message</span><textarea name="body" minlength="2" maxlength="2000" required></textarea></label><button class="button secondary" type="submit">Send private message</button></form></section>'+
 '</div></div>';
}
async function openSplitLine(id){
 state.selected=null;state.phase3.selected=await api('fulfillment-line-job',{params:{line_job_id:id}});
 render();window.scrollTo({top:0,behavior:'smooth'});
}

function render(){
 if(!state.session){
  heading('Merchlist production portal','Private manufacturing access · powered by Veelad','PARTNER FULFILLMENT');
  $('sign-out').hidden=true;
  const register=state.invitationToken&&state.authMode==='register';
  const action=register?'supplier-register':'supplier-login';
  $('content').innerHTML='<section class="card supplier-auth"><div class="supplier-auth-intro"><img class="supplier-auth-logo" src="/assets/veelad-wordmark-on-dark.svg" alt="Veelad" width="200" height="48"><p class="eyebrow">SECURE PARTNER ACCESS</p><h2>Print. Pack. Dispatch.</h2><p>Manage approved orders, print files, quality control and shipping in one workspace. Only assigned supplier jobs are visible.</p><div class="supplier-auth-steps"><span>01 · Orders</span><span>02 · Printing</span><span>03 · QC & packing</span><span>04 · Shipping</span></div></div><div class="supplier-auth-form"><h2>'+(register?'Create your supplier account':'Welcome back')+'</h2><p class="section-subtitle">'+(register?'Your invite is required to activate supplier access.':'Sign in using your own Veelad partner credentials.')+'</p><form data-form="'+action+'">'+(register?'<label class="field"><span>Full name</span><input name="name" autocomplete="name" maxlength="100" required></label>':'')+'<label class="field"><span>Work email</span><input type="email" name="email" autocomplete="email" required></label><label class="field"><span>Password</span><input type="password" name="password" autocomplete="'+(register?'new-password':'current-password')+'" minlength="'+(register?'12':'1')+'" maxlength="128" required></label><button type="submit" class="button accent">'+(register?'Create account and join':'Sign in to production portal')+'</button></form>'+(state.invitationToken?'<p class="form-help">'+(register?'Already have a Veelad account?':'New to this supplier workspace?')+' <button type="button" class="auth-switch" data-auth-mode="'+(register?'login':'register')+'">'+(register?'Sign in instead':'Create account with invitation')+'</button></p>':'<p class="form-help">Supplier access is by invitation from Veelad only. Ask your company manager for an invitation if needed.</p>')+'</div></section>';
  return;
 }
 syncNavigation();
 if(state.invitationToken){
  heading('Join your supplier workspace','Your invitation is one-time and restricted to your approved Veelad email account.');
  $('content').innerHTML='<section class="card">'+empty('Supplier invitation','Confirm that you trust the Veelad administrator who shared this link. Access will be restricted to the invited supplier company and role.')+'<div class="actions" style="justify-content:center"><button type="button" class="button accent" data-accept-invite>Accept supplier invitation</button></div></section>';return;
 }
 if(!state.session.admin&&state.session.suppliers.length===0){heading('Supplier access required','Your account needs to be approved by Veelad.');$('content').innerHTML='<section class="card">'+empty('No supplier permissions','Ask the Veelad administrator to invite your registered account to your company. No order data is available until access is granted.')+'</section>';return;}
 const section=views.find(v=>v.id===state.view)||views[0];
 heading(state.selected?'Production order '+state.selected.job.id:section.title,state.selected?'Review artwork, quality and shipping status.':section.subtitle, state.session.admin?'VEELAD · OPERATIONS ADMIN':'SUPPLIER WORKSPACE');
 if(state.phase3.selected){heading('Product line '+state.phase3.selected.job.line_id,'Restricted manufacturing workspace · '+state.phase3.selected.product.title);$('content').innerHTML=splitDetailView();return;}
 if(state.selected){$('content').innerHTML=detailView();return;}
 $('content').innerHTML=state.view==='overview'?dashboard():state.view==='suppliers'&&state.session.admin?suppliersView():state.view==='packaging'?ordersView('packing')+packagingDesk():state.view==='messages'?messagesView():state.view==='notifications'?notificationsView():state.view==='bulk'?bulkView():state.view==='split'?splitJobsView():state.view==='routing'?splitRoutingView():state.view==='analytics'?splitAnalyticsView():state.view==='invoices'?splitInvoicesView():state.view==='integrations'?splitIntegrationView():ordersView(state.view);
}
async function openOrder(id){state.selected=await api('fulfillment-order',{params:{order_id:id}});await Promise.all([loadPhase1(id),loadPhase2(id)]);render();window.scrollTo({top:0,behavior:'smooth'});}
async function progress(action,extra={}){
 if(!state.selected)return;
 const j=state.selected.job;
 if(['quality_check','packed'].includes(action)&&!confirm('Confirm that this production quality / packaging check has genuinely been completed?'))return;
 await api('fulfillment-progress',{method:'POST',body:{order_id:j.id,revision:j.revision,action,...extra}});
 notice('Production update saved.');await reload({preserveDetail:true});
}
async function submit(form){
 const data=Object.fromEntries(new FormData(form)),kind=form.dataset.form;
 if(kind==='supplier-login'||kind==='supplier-register'){
  if(!state.authCsrf)throw Error('Secure session not ready. Refresh and try again.');
  const route=kind==='supplier-register'?'register':'login';
  await api(route,{method:'POST',body:route==='register'?{name:data.name,email:data.email,password:data.password,role:'buyer'}:{email:data.email,password:data.password}});
  if(state.invitationToken){
   await api('fulfillment-invite',{method:'POST',body:{token:state.invitationToken}});
   state.invitationToken=null;history.replaceState(null,'','/fulfillment');
  }
  state.authCsrf=null;state.authMode='login';await bootstrap();notice('Signed in to your secure manufacturing workspace.');return;
 }
 if(kind==='split-route'){
  const selectors=[...form.querySelectorAll('[data-route-line]')];
  const allocations=selectors.map(sel=>({line_id:sel.dataset.routeLine,supplier_id:sel.value}));
  if(allocations.some(x=>!x.supplier_id)||new Set(allocations.map(x=>x.supplier_id)).size<2)throw Error('Assign every purchased line and choose at least two different suppliers.');
  if(!confirm('Create permanent separate manufacturing jobs for these product lines?'))return;
  await api('admin-fulfillment-route',{method:'POST',body:{order_id:state.phase3.routeOrder,allocations}});
  state.view='split';await reload();notice('Purchased product lines were assigned to distinct suppliers.');return;
 }
 if(kind==='line-preflight'){
  const job=state.phase3.selected.job;
  await api('admin-fulfillment-line-preflight',{method:'POST',body:{line_job_id:job.id,review_note:data.review_note,confirm:data.confirm==='on'}});
  await reload();notice('Supplier line print specification approved.');return;
 }
 if(kind==='line-photo'){
  const job=state.phase3.selected.job,file=form.querySelector('[name=photo]')?.files?.[0];
  if(!file||!['image/png','image/jpeg'].includes(file.type)||file.size>8*1024*1024)throw Error('Select a JPEG/PNG inspection photo of up to 8 MB.');
  const multipart=new FormData();multipart.set('artwork',file,file.name);
  const response=await fetch(urlFor('fulfillment-line-evidence-upload',{line_job_id:job.id,kind:data.kind}),{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':state.session.csrf},body:multipart,cache:'no-store'});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.ok)throw Error(result.error||'Supplier inspection upload failed.');
  await reload();notice('Photo submitted for independent QC review.');return;
 }
 if(kind==='line-issue'){
  await api('fulfillment-line-issues',{method:'POST',body:{line_job_id:state.phase3.selected.job.id,note:data.note}});
  await reload();notice('Manufacturing line placed on hold.');return;
 }
 if(kind==='line-packing'){
  const checks={};for(const key of ['garments','artwork','branding','insert','address','sealed'])checks[key]=data[key]==='on';
  await api('fulfillment-line-packaging',{method:'POST',body:{line_job_id:state.phase3.selected.job.id,checks}});
  await reload();notice('Packaging sign-off recorded for this supplier product line.');return;
 }
 if(kind==='line-dispatch'){
  const j=state.phase3.selected.job;
  await api('fulfillment-line-progress',{method:'POST',body:{line_job_id:j.id,revision:j.revision,action:'dispatch_submitted',carrier:data.carrier,tracking:data.tracking}});
  await reload();notice('Supplier tracking submitted for Veelad administrator approval.');return;
 }
 if(kind==='line-message'){
  await api('fulfillment-line-messages',{method:'POST',body:{line_job_id:state.phase3.selected.job.id,body:data.body}});
  await reload();notice('Message sent in the private product-line conversation.');return;
 }
 if(kind==='split-invoice'){
  const selected=[...form.querySelectorAll('[data-invoice-line]:checked')];
  if(!selected.length)throw Error('Choose a completed manufacturing product line.');
  const lines=selected.map(box=>({line_job_id:box.dataset.invoiceLine,
   unit_cost_minor:Number(form.querySelector('[data-invoice-cost="'+box.dataset.invoiceLine+'"]').value),
   tax_minor:Number(form.querySelector('[data-invoice-tax="'+box.dataset.invoiceLine+'"]').value)}));
  const result=await api('admin-fulfillment-invoice',{method:'POST',body:{supplier_id:data.supplier_id,invoice_number:data.invoice_number,currency:data.currency,note:data.note,lines}});
  state.phase3.invoice=(await api('fulfillment-invoice',{params:{invoice_id:result.id}})).invoice;
  await reload();notice('Draft manufacturing invoice created. No payment was initiated.');return;
 }
 if(kind==='split-api-key'){
  const issued=await api('admin-fulfillment-key',{method:'POST',body:{action:'create',supplier_id:data.supplier_id,label:data.label,scope:data.scope}});
  state.phase3.lastToken=issued.token;
  await reload();notice('90-day credential created. Copy it now; it cannot be retrieved again.');return;
 }
 if(kind==='supplier')await api('admin-fulfillment-supplier',{method:'POST',body:{name:data.name,status:'active'}});
 else if(kind==='member')await api('admin-fulfillment-member',{method:'POST',body:data});
 else if(kind==='assign'){
  const entry=state.pool.find(o=>o.id===data.order_id);
  if(entry?.needs_reconciliation){
   if(!confirm('This order was already marked PRINTING in Veelad. Only link it to Merchlist if printing has NOT already been dispatched to a manufacturer. Continue without creating a duplicate job?'))return;
   data.confirm_existing_printing=true;
  }
  await api('admin-fulfillment-assign',{method:'POST',body:data});
 }
 else if(kind==='invite'){
  const issued=await api('admin-fulfillment-invites',{method:'POST',body:data});
  state.inviteLink=issued.invitation_url;await loadAdminSetup();render();notice('Invitation created. Copy the secure link now and share it privately with the named employee.');return;
 }
 else if(kind==='print-spec'){
  for(const key of ['print_width_mm','print_height_mm','bleed_mm','min_dpi'])data[key]=Number(data[key]);
  await api('admin-fulfillment-print-specs',{method:'POST',body:data});await loadAdminSetup();render();notice('Supplier print specifications saved. Previous approvals are invalidated if the measurements changed.');return;
 }
 else if(kind==='preflight'){
  await api('admin-fulfillment-preflight',{method:'POST',body:{order_id:state.selected.job.id,review_note:data.review_note,confirm:data.confirm==='yes'}});
  await reload({preserveDetail:true});notice('Print preflight approved for these exact order details and supplier specifications.');return;
 }
 else if(kind==='photo'){
  const file=form.querySelector('[name=photo]')?.files?.[0];
  if(!file||!['image/png','image/jpeg'].includes(file.type)||file.size>8*1024*1024)throw Error('Choose a PNG or JPEG inspection photo, up to 8 MB.');
  const multipart=new FormData();multipart.set('artwork',file,file.name);
  const response=await fetch(urlFor('fulfillment-evidence-upload',{order_id:state.selected.job.id,line_id:data.line_id,kind:data.kind}),{method:'POST',body:multipart,credentials:'same-origin',headers:{'X-CSRF-Token':state.session.csrf},cache:'no-store'});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.ok!==true)throw Error(result.error||'Could not submit the inspection photograph.');
  await reload({preserveDetail:true});notice('Photograph submitted. A separate quality reviewer must approve it.');return;
 }
 else if(kind==='issue'){
  await api('fulfillment-issues',{method:'POST',body:{order_id:state.selected.job.id,category:data.category,severity:data.severity,note:data.note}});
  await reload({preserveDetail:true});notice('Production issue recorded. Work is paused until it is resolved.');return;
 }
 else if(kind==='packaging-policy'){
  await api('admin-fulfillment-packaging',{method:'POST',body:{supplier_id:data.supplier_id,category:data.category,container:data.container,instructions:data.instructions,inserts:String(data.inserts||'').split(',').map(s=>s.trim()).filter(Boolean),require_photo:!!data.require_photo}});
  state.activeSupplier=data.supplier_id;await reload();notice('Packaging policy saved. Existing signoffs with old specifications are invalidated.');return;
 }
 else if(kind==='sla'){
  await api('admin-fulfillment-sla',{method:'POST',body:{supplier_id:data.supplier_id,accept_hours:Number(data.accept_hours),production_hours:Number(data.production_hours),dispatch_hours:Number(data.dispatch_hours)}});
  state.activeSupplier=data.supplier_id;await reload();notice('Supplier SLA policy saved for future assignments.');return;
 }
 else if(kind==='deadline'){
  const converted={order_id:state.selected.job.id};
  for(const name of ['accept_by','production_by','dispatch_by']){
   const date=new Date(data[name]);
   if(!Number.isFinite(date.getTime()))throw Error('Choose all deadline dates and times.');
   converted[name]=date.toISOString();
  }
  await api('admin-fulfillment-deadline',{method:'POST',body:converted});
  await reload({preserveDetail:true});notice('Order deadlines updated.');return;
 }
 else if(kind==='packing-signoff'){
  const checks={};
  for(const key of ['garments','artwork','branding','insert','address','sealed'])checks[key]=data[key]==='on';
  await api('fulfillment-packaging-signoff',{method:'POST',body:{order_id:state.selected.job.id,checks}});
  await reload({preserveDetail:true});notice('Packaging checklist approved.');return;
 }
 else if(kind==='message'){
  const order_id=state.selected.job.id,file=form.querySelector('[name=photo]')?.files?.[0];
  if(file){
   if(!['image/png','image/jpeg'].includes(file.type)||file.size>8*1024*1024)throw Error('Attach a JPEG or PNG photo of at most 8 MB.');
   const multipart=new FormData();multipart.set('message',data.message);multipart.set('artwork',file,file.name);
   const response=await fetch(urlFor('fulfillment-message-upload',{order_id}),{method:'POST',credentials:'same-origin',body:multipart,headers:{'X-CSRF-Token':state.session.csrf},cache:'no-store'});
   const body=await response.json().catch(()=>({}));
   if(!response.ok||body.ok!==true)throw Error(body.error||'Could not send message attachment.');
  }else await api('fulfillment-messages',{method:'POST',body:{order_id,message:data.message}});
  await reload({preserveDetail:true});notice('Private order message sent.');return;
 }
 else if(kind==='shipping-event'){
  await api('fulfillment-shipping-events',{method:'POST',body:{order_id:state.selected.job.id,event_type:data.event_type,notes:data.notes}});
  await reload({preserveDetail:true});notice('Carrier event saved to the private shipment log.');return;
 }
 else if(kind==='hold')return progress('hold',{note:data.note});
 else if(kind==='dispatch')return progress('dispatch_submitted',{carrier:data.carrier,tracking:data.tracking});
 notice('Changes saved successfully.');await bootstrap();
}
async function bootstrap(){
 try{
  state.session=await api('fulfillment-session');
   // Store managers work from their own Veelad admin panel, not the supplier workplace.
   if(state.session.admin&&!state.invitationToken){location.replace('/en/admin?tab=fulfillment');return;}
   state.activeSupplier=state.session.suppliers[0]?.id||null;
  if(state.session.admin&&state.activeSupplier&&!state.session.suppliers.some(s=>s.id===state.activeSupplier))state.activeSupplier=null;
  $('environment').textContent=location.hostname.startsWith('staging.')?'STAGING':'';
  state.selected=null;state.phase3.selected=null;await reload();
 }catch(error){
  if(error.message==='Please sign in to continue.'){state.session=null;try{state.authCsrf=(await api('bootstrap')).csrf;}catch{notice('Unable to establish a secure sign-in session. Refresh the page.','error');}render();return;}
  notice(error.message,'error');state.session=null;render();
 }
}
$('navigation').addEventListener('click',event=>{
 const button=event.target.closest('[data-view]');if(!button)return;
 state.view=button.dataset.view;state.selected=null;state.phase3.selected=null;state.filter='all';state.search='';render();
});
$('supplier-picker').addEventListener('change',async event=>{
 state.activeSupplier=event.target.value||null;state.selected=null;state.phase3.selected=null;
 try{await reload();notice('');}catch(error){notice(error.message,'error');}
});
$('refresh').addEventListener('click',async()=>{try{await bootstrap();notice('Workspace refreshed.');}catch(error){notice(error.message,'error');}});
$('sign-out').addEventListener('click',async()=>{try{await api('logout',{method:'POST',body:{}});state.session=null;state.authCsrf=null;state.activeSupplier=null;state.selected=null;state.phase3.selected=null;await bootstrap();notice('You have signed out.');}catch(error){notice(error.message,'error');}});
$('content').addEventListener('click',async event=>{
 const b=event.target.closest('button');if(!b)return;
 try{
  b.disabled=true;
  if(b.dataset.authMode){state.authMode=b.dataset.authMode;notice('');render();}
  else if(b.dataset.view){state.view=b.dataset.view;state.selected=null;state.phase3.selected=null;render();}
  else if(b.dataset.lineOpen)await openSplitLine(b.dataset.lineOpen);
  else if(b.dataset.lineProgress){
   const j=state.phase3.selected.job,action=b.dataset.lineProgress;
   if(['packed','printing'].includes(action)&&!confirm('Confirm that the required physical manufacturing checks have been completed?'))return;
   await api('fulfillment-line-progress',{method:'POST',body:{line_job_id:j.id,revision:j.revision,action}});
   await reload();notice('Manufacturing line advanced to '+action.replaceAll('_',' ')+'.');
  }
  else if(b.dataset.lineDispatch){
   if(!confirm('Approve this supplier shipment? The customer order will be marked shipped only when ALL lines are dispatched.'))return;
   await api('admin-fulfillment-line-dispatch',{method:'POST',body:{line_job_id:b.dataset.lineDispatch}});
   await reload();notice('Supplier product-line dispatch approved.');
  }
  else if(b.dataset.lineReview){
   const evidence_id=b.dataset.lineReview,decision=b.dataset.lineDecision;
   let review_note='';
   if(decision==='rejected'){review_note=prompt('Describe why the print or packaging photo fails QC (at least 10 characters):')||'';if(review_note.trim().length<10)throw Error('A rejection needs a detailed correction note.');}
   else if(!confirm('Have you independently checked this inspection photograph against the approved sample?'))return;
   await api('fulfillment-line-evidence-review',{method:'POST',body:{line_job_id:state.phase3.selected.job.id,evidence_id,decision,review_note}});
   await reload();notice('Line inspection photo '+decision+'.');
  }
  else if(b.dataset.lineResolve){
   const resolution=prompt('Explain how the manufacturing issue was corrected (at least 10 characters):')||'';
   if(resolution.trim().length<10)throw Error('Describe the actual correction before resolving an issue.');
   await api('fulfillment-line-issue-resolve',{method:'POST',body:{line_job_id:state.phase3.selected.job.id,issue_id:b.dataset.lineResolve,resolution}});
   await reload();notice('Manufacturing issue resolved. Production may be resumed.');
  }
  else if(b.dataset.invoiceOpen){
   state.phase3.invoice=(await api('fulfillment-invoice',{params:{invoice_id:b.dataset.invoiceOpen}})).invoice;render();
  }
  else if(b.dataset.invoiceAction){
   const invoice=state.phase3.invoice,action=b.dataset.invoiceAction;
   if(!invoice)throw Error('Select a supplier invoice first.');
   const payload={invoice_id:invoice.id,action};
   if(action==='record_paid'){
    if(!confirm('Have you independently verified the supplier payment in your bank account?'))return;
    payload.payment_reference=prompt('Enter the external bank transfer reference (this does not send a payment):')||'';
    if(payload.payment_reference.trim().length<8)throw Error('An external settlement reference is required.');
   }else if(!confirm('Change supplier invoice status to '+action+'?'))return;
   await api('fulfillment-invoice-action',{method:'POST',body:payload});
   state.phase3.invoice=(await api('fulfillment-invoice',{params:{invoice_id:invoice.id}})).invoice;
   await reload();notice('Manufacturing invoice status updated. No funds were transferred.');
  }
  else if(b.hasAttribute('data-copy-api-token')){
   if(!state.phase3.lastToken)throw Error('New integration credential is no longer available.');
   await navigator.clipboard.writeText(state.phase3.lastToken);notice('Supplier API credential copied securely.');
  }
  else if(b.hasAttribute('data-dismiss-api-token')){state.phase3.lastToken=null;render();}
  else if(b.dataset.apiKeyRevoke){
   if(!confirm('Revoke this supplier API key immediately? Existing integrations using it will stop working.'))return;
   await api('admin-fulfillment-key',{method:'POST',body:{action:'revoke',id:b.dataset.apiKeyRevoke}});
   await reload();notice('Supplier integration credential revoked.');
  }
  else if(b.hasAttribute('data-sla-sweep')){
   const result=await api('admin-fulfillment-sla-sweep',{method:'POST',body:{}});
   await reload();notice('Deadline monitor checked '+result.scanned+' lines and generated '+result.generated+' new alerts.');
  }
  else if(b.dataset.open)await openOrder(b.dataset.open);
  else if(b.dataset.progress)await progress(b.dataset.progress);
  else if(b.dataset.supplierStatus){
   const supplier=state.session.suppliers.find(x=>x.id===b.dataset.supplierStatus);
   if(supplier&&confirm((supplier.status==='active'?'Suspend':'Reactivate')+' supplier '+supplier.name+'?')){
    await api('admin-fulfillment-supplier',{method:'POST',body:{id:supplier.id,name:supplier.name,status:supplier.status==='active'?'suspended':'active'}});
    notice('Supplier access updated.');await bootstrap();
   }
  }
  else if(b.hasAttribute('data-accept-invite')){
   await api('fulfillment-invite',{method:'POST',body:{token:state.invitationToken}});
   state.invitationToken=null;history.replaceState(null,'','/fulfillment');await bootstrap();notice('Invitation accepted. You can now access your supplier workspace.');
  }
  else if(b.hasAttribute('data-copy-invite')){
   if(!state.inviteLink)throw Error('No invitation link to copy.');
   await navigator.clipboard.writeText(state.inviteLink);notice('Invitation link copied. Send it privately to the verified employee.');
  }
  else if(b.dataset.revokeInvite){
   if(confirm('Revoke this invitation? The link will immediately become invalid.')){
    await api('admin-fulfillment-invite-revoke',{method:'POST',body:{id:b.dataset.revokeInvite}});
    await loadAdminSetup();render();notice('Invitation revoked.');
   }
  }
  else if(b.dataset.review){
   const approved=b.dataset.decision==='approved';
   const note=approved?'Reviewed the physical print against the approved sample and specifications.':prompt('Why was this inspection photo rejected? Explain the required correction:');
   if(!approved&&(!note||note.trim().length<10))throw Error('Explain the reason for rejecting this photograph.');
   if(approved&&!confirm('Approve this inspection photograph after personally checking it?'))return;
   await api('fulfillment-evidence-review',{method:'POST',body:{order_id:state.selected.job.id,evidence_id:b.dataset.review,decision:b.dataset.decision,note:note||''}});
   await reload({preserveDetail:true});notice(approved?'Inspection photograph approved.':'Photograph rejected, issue created and production paused.');
  }
  else if(b.dataset.resolve){
   const resolution=prompt('Describe the reprint, correction or other issue resolution:');
   if(!resolution||resolution.trim().length<10)throw Error('Explain the resolution in at least ten characters.');
   await api('fulfillment-issue-resolve',{method:'POST',body:{order_id:state.selected.job.id,issue_id:b.dataset.resolve,resolution}});
   await reload({preserveDetail:true});notice('Issue marked resolved. Production can resume after all issues are closed.');
  }
  else if(b.dataset.alertRead){
   await api('fulfillment-notification-read',{method:'POST',body:{id:b.dataset.alertRead}});
   await loadOperations();render();notice('Notification marked as read.');
  }
  else if(b.dataset.bulkAccept){
   if(!state.activeSupplier)throw Error('Choose a supplier account first.');
   const ids=[...document.querySelectorAll('input[data-bulk-job]:checked')].map(e=>e.dataset.bulkJob);
   if(!ids.length||ids.length>20)throw Error('Select 1 to 20 assigned jobs.');
   if(!confirm('Accept '+ids.length+' selected production jobs?'))return;
   const jobs=ids.map(id=>{const j=state.jobs.find(x=>x.id===id);return {order_id:id,revision:j.revision};});
   await api('fulfillment-bulk-accept',{method:'POST',body:{supplier_id:state.activeSupplier,jobs}});
   await reload();notice(ids.length+' production jobs accepted successfully.');
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
$('content').addEventListener('change',async event=>{if(event.target.id==='job-filter'){state.filter=event.target.value;render();}if(event.target.id==='bulk-all'){for(const input of document.querySelectorAll('[data-bulk-job]'))input.checked=event.target.checked;}if(event.target.id==='route-order-picker'){state.phase3.routeOrder=event.target.value;render();}if(event.target.id==='invoice-supplier-picker'){state.phase3.invoiceSupplier=event.target.value;state.activeSupplier=event.target.value;try{await reload();}catch(error){notice(error.message,'error');}}});
$('content').addEventListener('input',event=>{if(event.target.id==='job-search'){state.search=event.target.value;const pos=event.target.selectionStart;render();const input=$('job-search');input?.focus();input?.setSelectionRange(pos,pos);}});
if(state.invitationToken){state.authMode='register';history.replaceState(null,'','/fulfillment/invite');}
bootstrap();
})();
