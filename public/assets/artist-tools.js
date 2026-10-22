'use strict';
function artistListingForm(p=null) {
 const editing=!!p?.id;
 return `<form data-form="${editing?'artist-edit':'artist-product'}">${editing?`<input type="hidden" name="id" value="${esc(p.id)}">`:''}${p?.source_product_id?`<input type="hidden" name="source_product_id" value="${esc(p.source_product_id)}">`:''}${p?.upload_id?`<input type="hidden" name="upload_id" value="${esc(p.upload_id)}">`:''}
 ${p?.review?.feedback?`<div class="notice"><strong>${t('Administrator feedback')}</strong><p class="product-long-text">${esc(p.review.feedback)}</p></div>`:''}
 <header class="studio-title-banner"><span class="eyebrow">${t('YOUR DESIGN STUDIO')}</span><h2>${t('Create something worth wearing. And keeping.')}</h2><p>${t('You bring the art. Veelad reviews it, prepares the product, prints each order and ships it to your customer.')}</p></header>
 ${artistSubmissionChecklist(p)}${designArtworkUpload(p)}
 ${designPlacementPreview(p)}
 <section class="panel"><h3 class="studio-step-title">${t('03 / DETAILS & REVIEW')}</h3><p class="small">${t('English and Arabic describe the same design. English title and description are required for submission; Arabic fields are optional and fall back to English until translated.')}</p><div class="form-grid">
 ${field(t('Design title (English)'), 'title',p?.title||'','text','required maxlength="100" dir="ltr" lang="en"')}
 ${field(t('Design title (Arabic, optional)'), 'title_ar',p?.title_ar||'','text','maxlength="100" dir="rtl" lang="ar"')}
 <label class="field full">${t('Description (English)')}<textarea name="description" required maxlength="2000" dir="ltr" lang="en">${esc(p?.description||'')}</textarea></label>
 <label class="field full">${t('Description (Arabic, optional)')}<textarea name="description_ar" maxlength="2000" dir="rtl" lang="ar">${esc(p?.description_ar||'')}</textarea></label>
 ${field(t('Tags (English, comma separated)'), 'tags',(p?.tags||[]).join(', '),'text','maxlength="600" dir="ltr" lang="en"')}
 ${field(t('Tags (Arabic, comma separated)'), 'tags_ar',(p?.tags_ar||[]).join('، '),'text','maxlength="600" dir="rtl" lang="ar"')}
 <p class="small full">${t('Add up to 12 tags per language, up to 50 characters each.')}</p>
 <label class="field">${t('Preferred product type')}<select name="category">${cats.map(c=>`<option value="${esc(c)}" ${p?.category===c||(!p&&c==='Art prints')?'selected':''}>${esc(t(c))}</option>`).join('')}</select></label>
 <label class="field full">${t('Private production notes')}<textarea name="production_notes" maxlength="2000" placeholder="${esc(t('Share placement preferences or printing instructions for the Veelad team.'))}">${esc(p?.production_notes||'')}</textarea></label>
 </div>${designStyleFields(p)}${galleryUploadFields(p||{})}
 <p class="small">${t('Veelad sets retail pricing, product options and availability after reviewing the design. Your artist share is based on the approved product price; projections are not payable balances.')}</p>
 <p class="small">${t('Drafts and submissions are private. Administrator approval publishes a listing. Saving a published listing as a draft pauses it.')}</p>
 <label class="check"><input type="checkbox" name="rights" required>${t('I created this artwork or hold the rights needed to sell it.')}</label>
 <div class="artist-actions"><button class="btn outline" type="submit" name="action" value="draft" formnovalidate>${t('Save draft')}</button><button class="btn" type="submit" name="action" value="submit">${t(editing?'Resubmit for review':'Submit for review')}</button></div></section></form>`;
}
function artistStoryFields(a) {
 return `<label class="field full">${t('Your artist story (English)')}<textarea name="story" maxlength="3000" rows="6" dir="ltr" lang="en" placeholder="${esc(t('Share your influences, process, and the story behind your work.'))}">${esc(a.story||'')}</textarea></label><label class="field full">${t('Your artist story (Arabic, optional)')}<textarea name="story_ar" maxlength="3000" rows="6" dir="rtl" lang="ar">${esc(a.story_ar||'')}</textarea></label><div class="full"><h3>${t('Portfolio')}</h3><p class="small">${t('Select up to six pieces you own. Saving your profile makes these images public on your artist page.')}</p>${galleryUploadFields({gallery_upload_ids:a.portfolio_upload_ids||[]},{portfolio:true})}</div>`;
}
function artistProfilePage(a) {
 const ps=products.filter(p=>p.artist_id===a.id),portfolio=a.portfolio_upload_ids||[],name=localField(a,'name'),story=localField(a,'story');
 return `<main id="main" class="container section"><nav class="breadcrumb">${link(t('Home'),'home')} / ${link(t('Artists'),'artists')} / ${esc(name)}</nav><header class="artist-hero"><div class="avatar">${esc(a.initials)}</div><span class="eyebrow">${t('INDEPENDENT ARTIST')}</span><h1>${esc(name)}</h1><p>${esc(localField(a,'bio'))}</p><span class="small">${esc(localField(a,'location'))}</span><p class="small">${esc(t(ps.length===1?'{count} published design':'{count} published designs',{count:localNumber(ps.length)}))}</p><a class="btn outline" href="#artist-products">${t('Explore the products')}</a></header>
 ${story?`<section class="artist-story"><h2>${t('The story behind the art')}</h2><p class="product-long-text">${esc(story)}</p></section>`:''}
 ${portfolio.length?`<section class="section"><h2>${t('Portfolio')}</h2><p class="small">${esc(t('Original work shared by {name}.',{name}))}</p><div class="artist-portfolio">${portfolio.map((id,i)=>`<figure><img src="${esc(mode==='demo'?dbLocal.uploads[id]:'/api.php?route=image&id='+encodeURIComponent(id))}" alt="${esc(t('Portfolio artwork {number} by {name}',{number:localNumber(i+1),name}))}" loading="lazy"><figcaption>${esc(t('Artwork {number}',{number:localNumber(i+1)}))}</figcaption></figure>`).join('')}</div></section>`:''}
 <section id="artist-products" class="section">${title(t('From this creative corner.'),esc(t('Discover products featuring {name}’s work.',{name})))}${ps.length?grid(ps):empty(t('New work is on its way.'),t('This artist has no approved products yet.'),link(t('Meet more artists'),'artists','btn'))}</section></main>`;
}
async function refreshArtworkMetadata(uploadId=null) {
 const nodes=[...document.querySelectorAll('[data-artwork-metadata]')];
 for(const node of nodes) {
  if(uploadId){node.dataset.artworkMetadata=uploadId;delete node.dataset.metadataLoaded;}
  const artworkId=node.dataset.artworkMetadata;if(!artworkId||node.dataset.metadataLoaded||mode==='demo')continue;
  node.dataset.metadataLoaded='1';
  try {
   const value=await api('artwork-metadata',null,{id:artworkId});if(!node.isConnected||node.dataset.artworkMetadata!==artworkId)continue;
   const meta=value.artwork||value.metadata||value;
   setDesignStudioMetadata(meta,node.closest('form'));
   node.textContent=t('Original: {width} × {height} pixels · {size} MB. At 300 DPI: about {printWidth} × {printHeight} cm. Final print suitability needs Veelad review.',{width:localNumber(meta.width),height:localNumber(meta.height),size:localNumber(meta.size_bytes/1024/1024,{maximumFractionDigits:1}),printWidth:localNumber(meta.print_width_cm_300dpi),printHeight:localNumber(meta.print_height_cm_300dpi)});
  }catch(error){node.textContent=t(error.message);}
 }
}
new MutationObserver(()=>refreshArtworkMetadata()).observe(document.getElementById('app'),{childList:true,subtree:true});
new MutationObserver(()=>refreshArtworkMetadata()).observe(document.getElementById('modal'),{childList:true,subtree:true});

function artistSubmissionChecklist(p){return `<section class="submission-checklist panel" aria-label="${t('Submission checklist')}"><h3>${t('Submission checklist')}</h3><ol><li data-submit-check="art">${t('Attach the high-resolution original')}</li><li data-submit-check="details">${t('Add a title and description')}</li><li>${t('Check placement on every requested product')}</li><li>${t('Confirm your artwork rights before submitting')}</li></ol>${!p?.id?`<label class="check"><input type="checkbox" name="create_products">${t('Create a separate listing for each requested product')}</label><p class="small">${t('Choose two or more product types in the preview studio. Each listing has its own placement and administrator review. Pricing and stock are set by Veelad.')}</p>`:''}</section>`;}
document.addEventListener('click',event=>{const control=event.target.closest('[data-action=reuse-artist-design]');if(!control)return;event.preventDefault();const original=viewData?.products?.find(p=>p.id===control.dataset.id)||productById(control.dataset.id);if(!original)return;uploadId=null;openModal(t('Reuse this design'),artistListingForm({...original,id:null,source_product_id:original.id,review:null}));});

function updateArtistChecklist(form){if(!form)return;const node=form.querySelector('.submission-checklist');if(!node)return;node.querySelector('[data-submit-check=art]').dataset.complete=String(!!(form.querySelector('[name=upload_id]')?.value||form.querySelector('.design-studio')?.dataset.artworkId||uploadId));node.querySelector('[data-submit-check=details]').dataset.complete=String(!!form.elements.title?.value.trim()&&!!form.elements.description?.value.trim());}
document.addEventListener('input',event=>{if(event.target.closest('[data-form=artist-product],[data-form=artist-edit]'))updateArtistChecklist(event.target.closest('form'));});
document.addEventListener('design-studio-change',event=>updateArtistChecklist(event.target.closest('[data-form=artist-product],[data-form=artist-edit]')));

document.addEventListener('change',event=>{if(event.target.name!=='create_products')return;const note=event.target.closest('form')?.querySelector('.design-studio > p:last-child');if(note)note.textContent=t(event.target.checked?'Each requested product becomes a separate private listing for administrator review. Your original is never altered.':'The preferred product type below determines the listing image. Other formats are requests for review, not separate products for sale. Your original is never altered.');});
