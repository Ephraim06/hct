import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const script = await fs.readFile('assets/site.js','utf8');
async function page(file, query='') {
  const dom = new JSDOM(await fs.readFile(file,'utf8'), {url:`https://www.happycapetours.com/${file}${query}`, runScripts:'outside-only', pretendToBeVisual:true});
  dom.window.HCT_BACKEND={apiBaseUrl:'https://api.example.com'};
  dom.window.matchMedia = () => ({matches:false, addEventListener(){}});
  dom.window.HTMLElement.prototype.getClientRects = () => [{width:100,height:40}];
  if (file === 'gallery.html') {
    const grid=dom.window.document.getElementById('galleryGrid');
    for(const [caption,category] of [['Whale one','wildlife'],['Whale two','wildlife'],['Coast','landscape']]) {
      const item=dom.window.document.createElement('button');item.className='gallery-item';item.dataset.category=category;
      const image=dom.window.document.createElement('img');image.src='https://example.com/photo.webp';image.alt=caption;image.width=800;image.height=600;item.append(image);grid.append(item);
    }
  }
  dom.window.eval(script);
  return dom;
}
function submit(dom) { dom.window.document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})); }
function fill(dom) {
  const document=dom.window.document;
  for (const [id,value] of Object.entries({firstName:'Website',lastName:'Test',email:'test@example.com',message:'Test enquiry',travelDate:'2027-02-03',partySize:'2'})) document.getElementById(id).value=value;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('Formspree success sends all named fields, blocks duplicates and clears only after acceptance', async () => {
  const dom=await page('contact.html','?tour=Private%20Cape%20of%20Good%20Hope%20%26%20Penguins');
  try {
    const {document}=dom.window; fill(dom);
    assert.equal(document.getElementById('tourInterest').value,'Private Cape of Good Hope & Penguins');
    let accepted=[];document.addEventListener('hct:enquiry-accepted',e=>accepted.push(e.detail));
    let resolve, calls=0;
    dom.window.fetch = (url,options) => {
      calls++; assert.equal(url,'https://api.example.com/enquiries');
      assert.equal(options.method,'POST'); assert.equal(options.headers.Accept,'application/json');
      const payload=JSON.parse(options.body);assert.equal(payload.partySize,2);assert.equal(payload.travelDate,'2027-02-03');assert.equal(payload.tour,'Private Cape of Good Hope & Penguins');assert.match(payload.id,/^[a-f0-9-]{36}$/);
      return new Promise(done => {resolve=done;});
    };
    submit(dom); submit(dom);
    assert.equal(calls,1); assert.equal(document.getElementById('submitBtn').disabled,true);
    assert.equal(document.getElementById('message').value,'Test enquiry');
    const modal=document.getElementById('enquirySubmissionModal');assert.equal(modal.hidden,false);assert.equal(modal.dataset.state,'loading');assert.equal(document.getElementById('main-content').inert,true);document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(modal.hidden,false);
    resolve({ok:true,json:async()=>({accepted:true,stored:true,reference:'12345678-1234-4123-8123-123456789abc'})}); await tick();
    assert.equal(document.getElementById('message').value,'');
    assert.ok(document.getElementById('formStatus').hasAttribute('data-success'));
    assert.equal(document.getElementById('submitBtn').disabled,false);
    assert.equal(dom.window.localStorage.length,0);
    assert.equal(accepted.length,1);assert.equal(accepted[0].tourSlug,'cape-point-penguins-private-tour');assert.equal(modal.dataset.state,'success');assert.match(modal.textContent,/12345678/);modal.querySelector('button').click();assert.equal(modal.hidden,true);assert.equal(document.getElementById('main-content').inert,false);
  } finally {dom.window.close();}
});
for (const failure of ['http','network','timeout','unstored']) test(`Form ${failure} failure keeps enquiry and allows retry`, async () => {
  const dom=await page('contact.html');
  try {
    fill(dom);let accepted=0;dom.window.document.addEventListener('hct:enquiry-accepted',()=>accepted++);
    dom.window.fetch=async (url, options) => {
      if(failure==='unstored')return{ok:true,json:async()=>({accepted:true,reference:'discarded-reference'})};
      if(failure==='http') return {ok:false,json:async()=>({error:'We couldn’t confirm receipt. Please retry.'})};
      if(failure==='timeout') return new Promise((resolve,reject) => options.signal.addEventListener('abort', () => reject(new dom.window.DOMException('Aborted','AbortError')), {once:true}));
      throw new Error('Offline');
    };
    if (failure === 'timeout'){const original=dom.window.setTimeout.bind(dom.window);dom.window.setTimeout=(callback,delay)=>{if(delay===45000){queueMicrotask(callback);return 1;}return original(callback,delay);};}
    submit(dom); await tick();
    const document=dom.window.document;
    assert.equal(document.getElementById('message').value,'Test enquiry');
    assert.match(document.getElementById('formStatus').textContent,/couldn’t confirm/);
    assert.equal(document.getElementById('submitBtn').disabled,false);
    assert.equal(document.querySelector('form').hasAttribute('aria-busy'),false);assert.equal(accepted,0);const modal=document.getElementById('enquirySubmissionModal');assert.equal(modal.dataset.state,'error');modal.querySelector('button').click();assert.equal(modal.hidden,true);assert.equal(document.getElementById('message').value,'Test enquiry');
  } finally {dom.window.close();}
});
test('Invalid form never sends a request',async()=>{
  const dom=await page('contact.html');
  try {let calls=0;dom.window.fetch=()=>calls++;submit(dom);assert.equal(calls,0);} finally {dom.window.close();}
});
test('Filters correctly classify all eight tours, including adventure results',async()=>{
  const dom=await page('tours.html');
  try {
    const document=dom.window.document;
    assert.equal(document.getElementById('visibleCount').textContent,'8');
    document.querySelector('[data-filter="wine"]').click();
    assert.equal(document.getElementById('visibleCount').textContent,'1');
    assert.match(document.querySelector('.tour-card:not([hidden])').textContent,/Winelands/);
    document.querySelector('[data-filter="adventure"]').click();
    assert.equal(document.getElementById('visibleCount').textContent,'2');
    assert.equal(document.querySelector('[data-filter="adventure"]').getAttribute('aria-pressed'),'true');
  } finally {dom.window.close();}
});
test('PhotoSwipe receives only the active gallery category and preserves alt text',async()=>{
  const dom=await page('gallery.html');
  try {
    const {gallerySlides}=await import('../public/gallery-slides.mjs');
    const document=dom.window.document;
    document.querySelector('[data-filter="wildlife"]').click();
    const {items,slides}=gallerySlides(document.getElementById('galleryGrid'));
    assert.ok(items.length>0);
    assert.ok(items.every(item=>item.dataset.category==='wildlife'));
    assert.equal(slides.length,items.length);
    assert.equal(slides[0].alt,items[0].querySelector('img').alt);
    assert.ok(slides[0].width>0&&slides[0].height>0);
    assert.equal(document.getElementById('lightbox'),null);
    assert.ok(document.querySelector('script[src*="gallery-viewer.js"]'));
  } finally {dom.window.close();}
});
test('Menu closes with backdrop and Escape, restoring state and focus',async()=>{
  const dom=await page('index.html');
  try {
    const {document,KeyboardEvent}=dom.window;
    const toggle=document.getElementById('menuToggle'),menu=document.getElementById('offcanvas');
    toggle.focus();toggle.click();
    assert.equal(menu.inert,false); assert.equal(toggle.getAttribute('aria-expanded'),'true');
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));
    assert.equal(document.activeElement,[...menu.querySelectorAll('a[href],button')].at(-1));
    const backdrop=document.querySelector('.menu-backdrop');
    assert.notEqual(backdrop.inert,true); backdrop.click();
    assert.equal(menu.inert,true); assert.equal(document.activeElement,toggle);
    toggle.click(); document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    assert.equal(menu.inert,true); assert.equal(toggle.getAttribute('aria-expanded'),'false');
    assert.equal(document.querySelectorAll('[data-dialog-inert]').length,0);
  } finally {dom.window.close();}
});
test('FAQ controls expose current state and answer relationships',async()=>{
  const dom=await page('tours.html');
  try {
    const document=dom.window.document,button=document.querySelector('.faq-trigger');
    const answer=document.getElementById(button.getAttribute('aria-controls'));
    const previous=button.getAttribute('aria-expanded');button.click();
    assert.notEqual(button.getAttribute('aria-expanded'),previous);
    assert.equal(answer.hidden,button.getAttribute('aria-expanded')==='false');
  } finally {dom.window.close();}
});
