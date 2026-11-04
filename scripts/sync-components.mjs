import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const components = await Promise.all([['header','header'],['#offcanvas','menu'],['footer','footer'],['.policy-links','policy-links']].map(async ([selector,name])=>({selector,html:await fs.readFile(`templates/${name}.html`,'utf8')})));
for(const file of (await fs.readdir('.')).filter(file=>file.endsWith('.html'))) {
 if(file==='offline.html')continue;
 const dom=new JSDOM(await fs.readFile(file,'utf8'));const d=dom.window.document;
 for(const {selector,html} of components)d.querySelector(selector).outerHTML=html;
 if(file!=='admin.html'){
  if(!d.querySelector('script[src="assets/backend-config.js"]')){const script=d.createElement('script');script.src='assets/backend-config.js';script.defer=true;d.head.append(script);}
  if(!d.querySelector('script[src^="assets/analytics.js"]')){const script=d.createElement('script');script.src='assets/analytics.js?v=analytics-1';script.defer=true;d.head.append(script);}
 }
 for(const style of d.querySelectorAll('link[href^="assets/site.css"],link[href^="assets/tailwind.min.css"]'))style.setAttribute('href',style.getAttribute('href').split('?')[0]+'?v=pwa-controls-1');
 const siteScript=d.querySelector('script[src^="assets/site.js"]');if(siteScript)siteScript.setAttribute('src','assets/site.js?v=pwa-controls-1');
 for(const script of d.querySelectorAll('script[src^="assets/traveller/"]'))script.setAttribute('src',script.getAttribute('src').split('?')[0]+'?v='+(file==='account.html'?'admin-controls-2':'pwa-controls-1'));
 const viewport=d.querySelector('meta[name="viewport"]');if(viewport&&!viewport.content.includes('viewport-fit'))viewport.content+=', viewport-fit=cover';
 for(const [name,content] of [['theme-color','#0b3944'],['apple-mobile-web-app-capable','yes'],['mobile-web-app-capable','yes'],['apple-mobile-web-app-title','Happy Cape Tours'],['apple-mobile-web-app-status-bar-style','black-translucent']]){let tag=d.querySelector(`meta[name="${name}"]`);if(!tag){tag=d.createElement('meta');tag.setAttribute('name',name);d.head.append(tag);}tag.setAttribute('content',content);}
 for(const [src,type] of [['assets/controls.js?v=pwa-controls-1','module'],['assets/pwa.js?v=pwa-controls-1','']])if(!d.querySelector(`script[src^="${src.split('?')[0]}"]`)){const script=d.createElement('script');script.src=src;if(type)script.type=type;else script.defer=true;d.head.append(script);}
 if(!d.querySelector('link[href^="assets/controls.css"]')){const style=d.createElement('link');style.rel='stylesheet';style.href='assets/controls.css?v=pwa-controls-1';d.head.append(style);}
 for(const link of d.querySelectorAll('header a, #offcanvas a'))if(link.getAttribute('href')===file)link.setAttribute('aria-current','page');
 await fs.writeFile(file,dom.serialize().split('\n').map(line=>line.trimEnd()).join('\n').replace(/\n{3,}/g,'\n\n')+'\n');
}
console.log('Synchronized shared header, navigation and footer components.');
