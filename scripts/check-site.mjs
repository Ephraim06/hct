import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
const files = (await fs.readdir('.')).filter(name => name.endsWith('.html'));
const origin = 'https://www.happycapetours.com/';
const docs = new Map();
for (const name of files) docs.set(name,new JSDOM(await fs.readFile(name,'utf8')).window.document);
let links = 0;
for (const [name, document] of docs) {
  assert.equal(document.querySelectorAll('main').length,1,`${name}: main landmark`);
  assert.equal(document.querySelectorAll('h1').length,1,`${name}: page heading`);
  assert.equal(document.querySelectorAll('a button, button a, button button').length,0,`${name}: nested interactive content`);
  const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
  assert.equal(ids.length,new Set(ids).size,`${name}: duplicate IDs`);
  for (const el of document.querySelectorAll('[href], [src], [poster]')) {
    for (const attr of ['href','src','poster']) {
      if (!el.hasAttribute(attr)) continue;
      const value = el.getAttribute(attr);
      assert.ok(value && value !== '#',`${name}: empty destination`);
      const url = new URL(value,new URL(name,origin));
      if (url.origin !== new URL(origin).origin || !['https:','http:'].includes(url.protocol)) continue;
      const target = decodeURIComponent(url.pathname.slice(1)) || 'index.html';
      assert.ok(existsSync(target),`${name}: missing ${target}`);
      if (url.hash && docs.has(target)) assert.ok(docs.get(target).getElementById(decodeURIComponent(url.hash.slice(1))),`${name}: missing fragment ${url.href}`);
      links++;
    }
  }
  for (const control of document.querySelectorAll('a, button')) {
    assert.ok(control.textContent.trim() || control.getAttribute('aria-label') || control.querySelector('img[alt]'), `${name}: unnamed control`);
  }
  for (const image of document.images) {
    assert.ok(image.hasAttribute('alt'),`${name}: image description`);
    assert.ok(image.width > 0 && image.height > 0,`${name}: image dimensions`);
    for (const source of (image.getAttribute('srcset') || '').split(',').filter(Boolean)) assert.ok(existsSync(source.trim().split(' ')[0]),`${name}: missing responsive image`);
  }
  for (const label of document.querySelectorAll('label')) assert.ok(document.getElementById(label.htmlFor),`${name}: associated label`);
  for (const schema of document.querySelectorAll('script[type="application/ld+json"]')) JSON.parse(schema.textContent);
  assert.equal(document.querySelectorAll('script[src^="assets/site.js"]').length,1,`${name}: shared behavior`);
  assert.equal(document.querySelectorAll('link[rel="manifest"]').length,1,`${name}: manifest`);
  assert.ok(!document.documentElement.outerHTML.includes('cdn.tailwindcss.com'),`${name}: runtime CSS`);
}
const contact = docs.get('contact.html');
assert.equal(contact.querySelector('form').action,'https://formspree.io/f/meaaveoz');
assert.equal(contact.querySelector('form').method,'post');
for (const name of ['email','tour','message','travel-date','party-size']) assert.ok(contact.querySelector(`[name="${name}"]`),`Form field ${name}`);
for (const [name,document] of docs) {
  if (!document.querySelector('.price-note')) continue;
  assert.ok([...document.querySelectorAll('a[href]')].some(a => a.href.includes('contact.html?tour=')),`${name}: working tour enquiry`);
}
const manifest = JSON.parse(await fs.readFile('images/site.webmanifest','utf8'));
for (const icon of manifest.icons) assert.ok(existsSync(icon.src.slice(1)));
console.log(`Checked ${files.length} pages and ${links} local destinations; metadata, landmarks, form and responsive images passed.`);
