'use strict';
function artistListingForm(p=null) {
 const formats=Array.isArray(p?.print_formats)?p.print_formats:[p?.category||'Art prints'];
 return `<form data-form="${p?'artist-edit':'artist-product'}">${p?`<input type="hidden" name="id" value="${esc(p.id)}">`:''}${p?.upload_id?`<input type="hidden" name="upload_id" value="${esc(p.upload_id)}">`:''}
 ${p?.review?.feedback?`<div class="notice"><strong>${t('Administrator feedback')}</strong><p class="product-long-text">${esc(p.review.feedback)}</p></div>`:''}
 <div class="notice"><h3>${t('You create. We print and ship.')}</h3><p>${t('Upload your original design and choose the products you would like it printed on. Veelad reviews the artwork, sets the final product specifications and prices, prints each order, and ships it to the customer.')}</p></div>
 <div class="upload-zone"><div id="upload-preview">${p?.upload_id?photo(p):icon('upload')}</div><h3>${t('Your original artwork')}</h3><p>${t('PNG or JPEG, up to 25 MB and 60 megapixels. Minimum 100 pixels on each side. Drafts can be saved before uploading.')}</p><p class="small">${t('Upload your highest-quality original. A transparent PNG is useful when the product needs no background. SVG and PDF are not accepted yet.')}</p><p class="small">${t('For sharp printing, aim for 300 DPI at the actual print size: for example, 3000 × 3000 pixels for a 25.4 × 25.4 cm print. Veelad checks the production template, bleed and color before printing.')}</p><input type="file" id="artwork-file" accept="image/png,image/jpeg" aria-label="${esc(t('Choose artwork file'))}"><p id="upload-status">${t(p?.upload_id?'Existing artwork retained until replaced.':'Add artwork before submitting for review.')}</p><p class="small artwork-metadata" data-artwork-metadata="${esc(p?.upload_id||'')}" role="status"></p></div>
 ${designPlacementPreview(p)}
 <section class="panel"><p class="small">${t('English and Arabic describe the same design. English title and description are required for submission; Arabic fields are optional and fall back to English until translated.')}</p><div class="form-grid">
 ${field(t('Design title (English)'), 'title',p?.title||'','text','required maxlength="100" dir="ltr" lang="en"')}
 ${field(t('Design title (Arabic, optional)'), 'title_ar',p?.title_ar||'','text','maxlength="100" dir="rtl" lang="ar"')}
 <label class="field full">${t('Description (English)')}<textarea name="description" required maxlength="2000" dir="ltr" lang="en">${esc(p?.description||'')}</textarea></label>
 <label class="field full">${t('Description (Arabic, optional)')}<textarea name="description_ar" maxlength="2000" dir="rtl" lang="ar">${esc(p?.description_ar||'')}</textarea></label>
 ${field(t('Tags (English, comma separated)'), 'tags',(p?.tags||[]).join(', '),'text','maxlength="600" dir="ltr" lang="en"')}
 ${field(t('Tags (Arabic, comma separated)'), 'tags_ar',(p?.tags_ar||[]).join('، '),'text','maxlength="600" dir="rtl" lang="ar"')}
 <p class="small full">${t('Add up to 12 tags per language, up to 50 characters each.')}</p>
 <label class="field">${t('Preferred product type')}<select name="category">${cats.map(c=>`<option value="${esc(c)}" ${p?.category===c||(!p&&c==='Art prints')?'selected':''}>${esc(t(c))}</option>`).join('')}</select></label>
 <fieldset class="field full"><legend>${t('Requested print formats')}</legend><div class="artist-actions">${cats.map(c=>`<label class="check"><input type="checkbox" name="print_formats" value="${esc(c)}" ${formats.includes(c)?'checked':''}>${esc(t(c))}</label>`).join('')}</div><p class="small">${t('These are requests for the same design. The administrator confirms each final product before publication.')}</p></fieldset>
 <label class="field full">${t('Private production notes')}<textarea name="production_notes" maxlength="2000" placeholder="${esc(t('Share placement preferences or printing instructions for the Veelad team.'))}">${esc(p?.production_notes||'')}</textarea></label>
 </div>${galleryUploadFields(p||{})}
 <p class="small">${t('Veelad sets retail pricing, product options and availability after reviewing the design. Your artist share is based on the approved product price; projections are not payable balances.')}</p>
 <p class="small">${t('Drafts and submissions are private. Administrator approval publishes a listing. Saving a published listing as a draft pauses it.')}</p>
 <label class="check"><input type="checkbox" name="rights" required>${t('I created this artwork or hold the rights needed to sell it.')}</label>
 <div class="artist-actions"><button class="btn outline" type="submit" name="action" value="draft" formnovalidate>${t('Save draft')}</button><button class="btn" type="submit" name="action" value="submit">${t(p?'Resubmit for review':'Submit for review')}</button></div></section></form>`;
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
   node.textContent=t('Original: {width} × {height} pixels · {size} MB. At 300 DPI: about {printWidth} × {printHeight} cm. Final print suitability needs Veelad review.',{width:localNumber(meta.width),height:localNumber(meta.height),size:localNumber(meta.size_bytes/1024/1024,{maximumFractionDigits:1}),printWidth:localNumber(meta.print_width_cm_300dpi),printHeight:localNumber(meta.print_height_cm_300dpi)});
  }catch(error){node.textContent=t(error.message);}
 }
}
new MutationObserver(()=>refreshArtworkMetadata()).observe(document.getElementById('app'),{childList:true,subtree:true});
new MutationObserver(()=>refreshArtworkMetadata()).observe(document.getElementById('modal'),{childList:true,subtree:true});
