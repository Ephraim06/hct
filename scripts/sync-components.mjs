import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const components = await Promise.all([['header','header'],['#offcanvas','menu'],['footer','footer'],['.policy-links','policy-links']].map(async ([selector,name])=>({selector,html:await fs.readFile(`templates/${name}.html`,'utf8')})));
for(const file of (await fs.readdir('.')).filter(file=>file.endsWith('.html'))) {
 const dom=new JSDOM(await fs.readFile(file,'utf8'));const d=dom.window.document;
 for(const {selector,html} of components)d.querySelector(selector).outerHTML=html;
 if(file!=='admin.html'){
  if(!d.querySelector('script[src="assets/backend-config.js"]')){const script=d.createElement('script');script.src='assets/backend-config.js';script.defer=true;d.head.append(script);}
  if(!d.querySelector('script[src^="assets/analytics.js"]')){const script=d.createElement('script');script.src='assets/analytics.js?v=analytics-1';script.defer=true;d.head.append(script);}
 }
 for(const style of d.querySelectorAll('link[href^="assets/site.css"],link[href^="assets/tailwind.min.css"]'))style.setAttribute('href',style.getAttribute('href').split('?')[0]+'?v=inbox-gallery-1');
 const siteScript=d.querySelector('script[src^="assets/site.js"]');if(siteScript)siteScript.setAttribute('src','assets/site.js?v=inbox-gallery-1');
 for(const script of d.querySelectorAll('script[src^="assets/traveller/"]'))script.setAttribute('src',script.getAttribute('src').split('?')[0]+'?v=inbox-gallery-1');
 for(const link of d.querySelectorAll('header a, #offcanvas a'))if(link.getAttribute('href')===file)link.setAttribute('aria-current','page');
 await fs.writeFile(file,dom.serialize().split('\n').map(line=>line.trimEnd()).join('\n').replace(/\n{3,}/g,'\n\n')+'\n');
}
console.log('Synchronized shared header, navigation and footer components.');
