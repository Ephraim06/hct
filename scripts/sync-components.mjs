import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const components = await Promise.all([['header','header'],['#offcanvas','menu'],['footer','footer'],['.policy-links','policy-links']].map(async ([selector,name])=>({selector,html:await fs.readFile(`templates/${name}.html`,'utf8')})));
for(const file of (await fs.readdir('.')).filter(file=>file.endsWith('.html'))) {
 const dom=new JSDOM(await fs.readFile(file,'utf8'));const d=dom.window.document;
 for(const {selector,html} of components)d.querySelector(selector).outerHTML=html;
 for(const link of d.querySelectorAll('header a, #offcanvas a'))if(link.getAttribute('href')===file)link.setAttribute('aria-current','page');
 await fs.writeFile(file,dom.serialize().split('\n').map(line=>line.trimEnd()).join('\n').replace(/\n{3,}/g,'\n\n')+'\n');
}
console.log('Synchronized shared header, navigation and footer components.');
