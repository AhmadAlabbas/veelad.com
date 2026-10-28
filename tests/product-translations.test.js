import {test} from 'node:test';
import assert from 'node:assert/strict';
import {translationCapability,validateTranslationSource,validateTranslationDraft,validateCategoryTranslations,generateTranslationDraft,productTranslationRoute} from '../src/product-translations.js';

const source={title:'Night garden',description:'An original drawing of a moonlit garden.',tags:['garden','moon']};
const draft={title:'月夜花园',description:'描绘月光下花园的原创画作。',tags:['花园','月亮'],seo_title:'月夜花园原创画作',seo_description:'欣赏描绘月光下花园的原创画作。'};
const config={translations:{enabled:true,apiKey:'fixture-not-a-real-key',model:'fixture-model'}};
const provider=value=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]}),{headers:{'Content-Type':'application/json'}});
test('AI assistance is unavailable unless explicitly configured; source/output validation is bounded',async()=>{
 assert.equal(translationCapability({}).available,false);assert.equal(translationCapability(config).available,true);assert.equal(translationCapability(config).auto_publish,false);
 await assert.rejects(generateTranslationDraft({},source,'zh-CN'),{status:503});
 assert.deepEqual(validateTranslationSource({...source,private_production_notes:'must not send'}),source);
 assert.throws(()=>validateTranslationSource({...source,title:'<script>alert(1)</script>'}),{status:422});
 assert.throws(()=>validateTranslationSource({...source,tags:Array(13).fill('x')}),{status:422});
 assert.throws(()=>validateTranslationDraft({...draft,unexpected:'claim'}),{status:502});
 assert.throws(()=>validateTranslationDraft({...draft,title:'画'.repeat(100)}),{status:502});
 assert.throws(()=>validateTranslationDraft({...draft,description:'<img src=x>'}),{status:502});
});
test('AI request uses a fixed endpoint, bounded JSON response and no auto publication',async()=>{
 let sent;
 const result=await generateTranslationDraft(config,{...source,private:'secret'},'zh-CN',{fetch:async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.redirect,'error');sent=JSON.parse(options.body);assert.equal(sent.store,false);return provider(draft);}});
 assert.deepEqual(result.draft,draft);assert.equal(result.requires_review,true);assert.equal(result.published,false);assert.match(result.source_hash,/^[a-f0-9]{64}$/);
 assert.deepEqual(JSON.parse(sent.input[0].content),source);assert.equal(sent.text.format.schema.additionalProperties,false);
 await assert.rejects(generateTranslationDraft(config,source,'en',{fetch:async()=>{throw Error('must not call');}}),{status:422});
 await assert.rejects(generateTranslationDraft(config,source,'zh-CN',{fetch:async()=>new Response('Unauthorized',{status:401})}),{status:503});
 await assert.rejects(generateTranslationDraft(config,source,'zh-CN',{fetch:async()=>new Response(JSON.stringify({status:'incomplete',output:[]}))}),{status:502});
 await assert.rejects(generateTranslationDraft(config,source,'zh-CN',{fetch:async()=>new Response('x'.repeat(100001))}),{status:503});
});
test('category translations accept only the seven existing identities and three languages',()=>{
 const value={version:0,labels:{'T-shirts':{en:'T-shirts',ar:'قمصان', 'zh-CN':'T恤'}}};assert.deepEqual(validateCategoryTranslations(value),value);
 for(const invalid of [{...value,version:-1},{...value,labels:{Shoes:{en:'Shoes'}}},{...value,labels:{'T-shirts':{fr:'Vêtements'}}},{...value,labels:{'T-shirts':{en:'<script>'}}}])assert.throws(()=>validateCategoryTranslations(invalid),{status:422});
});
test('translation route enforces ownership and consent before provider invocation',async()=>{
 let providerCalls=0,audits=0;const base={route:'product-translation-draft',method:'POST',v:{id:'p1',source,locale:'zh-CN',consent:true},req:{query:{}},res:{json(value){this.body=value;}},db:{one:async()=>({artist_id:'artist-owner'})},c:config,role:async()=>({id:'another-artist',role:'artist'}),throttle:async()=>{},audit:async()=>{audits++;},translationFetch:async()=>{providerCalls++;return provider(draft);}};
 await assert.rejects(productTranslationRoute(base),{status:403});assert.equal(providerCalls,0);
 await assert.rejects(productTranslationRoute({...base,v:{...base.v,consent:false}}),{status:422});assert.equal(providerCalls,0);
 const allowed={...base,role:async()=>({id:'artist-owner',role:'artist'})};assert.equal(await productTranslationRoute(allowed),true);assert.equal(providerCalls,1);assert.equal(audits,1);assert.equal(allowed.res.body.published,false);
 const denied={...base,route:'admin-product-translations',method:'GET',role:async(_req,...roles)=>{assert.deepEqual(roles,['admin']);throw Object.assign(Error('Forbidden'),{status:403});}};await assert.rejects(productTranslationRoute(denied),{status:403});
});
