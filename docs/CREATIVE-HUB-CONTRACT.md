# Creative experiences API contract

The root dispatcher applies the deployment gate and existing same-origin, session and CSRF middleware. `creativeRoute(ctx)` handles the following APIs. All page numbers are zero-based, page size 12, maximum page 1000. Authenticated writes are rate-limited. Public DTOs omit email, contact information, private upload IDs and source paths. Product images are approved bounded preview derivatives served by product ID.

## Discovery, preferences and guided creation

- GET `creative-discover`: `{enabled,options:{styles:[{id,en,ar}],colors:[hex],moods:[{id,en,ar}],occasions:[{id,en,ar}],categories:[string]},templates:[],stories:[],recommendations:[product],taste:null|profile}`. A profile is read only for its own authenticated account and only exists after explicit consent.
- GET `creative-taste`: `{taste:null|{version,styles,colors,moods,language,consent:true}}`; POST same route `{consent:true,styles:[option IDs],colors:[option hexes],moods:[option IDs],language:'en|ar',version?}`. Existing preferences require current `version`. POST `{action:'delete'}` removes the profile.
- POST `creative-brief`: `{occasion,recipient,story,mood,category,language,budget_minor?}` creates a private brief with `{brief:{id,version,...input,concept:{title,title_ar,palette,layout,headline,caption,font},recommendations,templates},method:'guided_template_matching',ai_generated:false}`. These are deterministic editable design directions, not AI-rendered images.
- GET `creative-briefs`: `{briefs,pagination}` owned records only. POST `creative-brief` `{id,action:'delete'}` deletes an owned brief.
- POST `creative-gift-guide`: same inputs (story/recipient optional), plus optional `save:true`; `{concept,recommendations,templates,method,ai_generated:false,brief?}`. No storage unless explicitly saved by an authenticated account.

## Wish board

- GET `creative-wishes?page=0`: `{wishes,pagination}` moderated public records. GET `creative-wish?id=...`: `{wish,concepts}`; owner can preview its own draft/pending record.
- POST `creative-wish`: `{id?,version?,title,title_ar?,description,description_ar?,category,action:'draft|submit|cancel'}`. Existing changes require current version; edited public wishes return to draft/review.
- POST `creative-wish-interest`: `{wish_id,kind:'vote|follow',active:boolean}` returns `{wish}`. Idempotent per-account membership, no anonymous votes. Wish DTO includes `vote_count,follower_count,viewer_voted,viewer_following`.
- POST `creative-concept`: artist/administrator `{id?,version?,wish_id,title,title_ar?,description,description_ar?,product_id?,action:'draft|submit|cancel'}`. Linked product must belong to the author. Only approved concepts appear publicly.

## Artist collections and living stories

- GET `creative-stories?page=0` / `creative-templates?page=0`: `{stories|templates,pagination}`. GET `creative-story?id` / `creative-template?id`: `{story|template}`. Author preview allowed; public needs approved record, active source product and active author.
- POST `creative-story`: artist/administrator `{id?,version?,product_id,title,title_ar?,description,description_ar?,inspiration,inspiration_ar?,process,process_ar?,action:'draft|submit',sketch_product_ids:[owned active product IDs],marketing_permission:true}`. Sketches are previews of approved products, never private source uploads. Public story includes `sketches:[product]`, approved `contributions`, `qr_url`.
- POST `creative-template`: artist/administrator `{id?,version?,product_id,title,title_ar?,description,description_ar?,composition:{background,surface,fields:[{id,label,label_ar,default,default_ar,max_length,x,y,size,font,color,align,direction}],fixed_text:[]},allowed_fonts:[font IDs],palette:[hex],rights_confirmed:true,action:'draft|submit'}`. Product must be customizable. Typography-only composition is authoritative; artwork visible on the original product is not included. Geometry/font validation is owned by `creative-personalisation.js`.
- GET `creative-workspace`: authenticated `{wishes,concepts,stories,templates,contributions,products}` own records, each bounded to 100; products include owned active products. Feedback is visible only to author/admin.
- GET `creative-product-preview?id=productID`: bounded metadata-stripped WebP for an active published product; no original file response.
- GET `creative-story-qr?id=...&language=en|ar`: SVG linking to the approved story's localized page.
- POST `creative-contribution`: `{story_id,upload_id,caption,consent:true}` submits an owned image to review. POST `{id,action:'withdraw'}` withdraws publication consent. GET `creative-contribution-image?id`: approved contribution derivative only, requiring its parent story and product remain public. No original upload identifier is returned in a public DTO.

## Moderation

- GET `admin-creative`: administrator-only `{wishes,concepts,stories,templates,contributions}`, pending queues bounded to 100 per type, plus totals.
- POST `admin-creative-review`: `{kind:'wish|concept|story|template|contribution',id,version,status:'approved|rejected',reason}`. Decision requires expected version, reason and valid live dependencies. All decisions are audit-logged. No mass publication or invented artist records.

Every mutable authored record returns `{id,version,status,title,title_ar,description,description_ar,category?,author:{name},product?,created_at,updated_at}`. Private author views additionally include editable validated `data` and feedback. Public templates expose safe typography `composition,allowed_fonts,palette`, with no source artwork identifiers. Gift matching explains its method and never claims stock, fulfillment estimates or print calibration that have not been confirmed.
