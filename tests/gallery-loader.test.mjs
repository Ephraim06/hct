import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {JSDOM} from 'jsdom';
const source=await fs.readFile('assets/gallery-loader.js','utf8');
const site=await fs.readFile('assets/site.js','utf8');
async function page(){const dom=new JSDOM(await fs.readFile('gallery.html','utf8'),{url:'https://www.happycapetours.com/gallery.html',runScripts:'outside-only',pretendToBeVisual:true});dom.window.matchMedia=()=>({matches:false,addEventListener(){}});dom.window.CSS={escape:value=>value};dom.window.eval(site);return dom;}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('Published uploads retain display order, join category filters and open with safe captions',async()=>{
 const dom=await page();try{
  const {document}=dom.window;const original=document.querySelectorAll('.gallery-item').length;
  dom.window.HCT_BACKEND={apiBaseUrl:'https://api.example'};
  const images=[{id:'first',src:'/media/first',caption:'<script>unsafe()</script>',alt:'Whale near Hermanus',category:'wildlife',width:1600,height:1000},{id:'second',src:'/media/second',caption:'Cape Point coast',alt:'Cape Point coastline',category:'landscape',width:1200,height:800}];
  dom.window.fetch=async()=>({ok:true,json:async()=>({images})});dom.window.eval(source);await tick();
  assert.equal(document.querySelectorAll('.gallery-item').length,original+2);
  assert.equal(document.querySelector('.gallery-item').dataset.uploadId,'first');
  document.querySelector('[data-filter="wildlife"]').click();
  assert.equal(document.querySelector('[data-upload-id="first"]').hidden,false);assert.equal(document.querySelector('[data-upload-id="second"]').hidden,true);
  document.querySelector('[data-filter="people"]').click();assert.match(document.getElementById('galleryStatus').textContent,/No photos in this category/);
  document.querySelector('[data-filter="wildlife"]').click();
  document.querySelector('[data-upload-id="first"]').click();assert.equal(document.getElementById('lightboxCaption').textContent,'<script>unsafe()</script>');assert.equal(document.getElementById('lightboxCaption').children.length,0);
 }finally{dom.window.close();}
});
test('The public gallery contains no bundled photos and shows an empty state when no uploads are published',async()=>{
 const dom=await page();try{const d=dom.window.document;assert.equal(d.querySelectorAll('#galleryGrid img').length,0);dom.window.HCT_BACKEND={apiBaseUrl:'https://api.example'};dom.window.fetch=async()=>({ok:true,json:async()=>({images:[]})});dom.window.eval(source);await tick();assert.equal(d.querySelectorAll('.gallery-item').length,0);assert.match(d.getElementById('galleryStatus').textContent,/Check back soon/);}finally{dom.window.close();}
});
test('An unavailable gallery API shows an error and never restores old static photos',async()=>{
 const dom=await page();try{dom.window.HCT_BACKEND={apiBaseUrl:'https://api.example'};dom.window.fetch=async()=>{throw new Error('offline');};dom.window.eval(source);await tick();assert.equal(dom.window.document.querySelectorAll('.gallery-item').length,0);assert.match(dom.window.document.getElementById('galleryStatus').textContent,/temporarily unavailable/);}finally{dom.window.close();}
});
