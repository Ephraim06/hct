import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {JSDOM} from 'jsdom';

const sources = [];
async function walk(directory) {
  for (const entry of await fs.readdir(directory, {withFileTypes:true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name !== 'optimized') await walk(file);
    else if (entry.isFile() && /\.jpe?g$/i.test(file)) sources.push(file);
  }
}
await walk('images');
const images = new Map();
for (const source of sources) {
  const metadata = await sharp(source).metadata();
  const stem = source.replace(/^images\//, '').replace(/\.[^.]+$/, '').replaceAll('/', '-');
  const variants = [];
  for (const width of [...new Set([480,960,1600].map(width => Math.min(width, metadata.width)))]) {
    const target = `images/optimized/${stem}-${width}.webp`;
    await fs.mkdir(path.dirname(target), {recursive:true});
    await sharp(source).rotate().resize({width, withoutEnlargement:true}).webp({quality:78}).toFile(target);
    variants.push({width, target});
  }
  images.set(source, {variants, width:metadata.width, height:metadata.height});
}
let before = 0, after = 0;
for (const [source, data] of images) {
  before += (await fs.stat(source)).size;
  after += (await fs.stat(data.variants.at(-1).target)).size;
}
for (const name of (await fs.readdir('.')).filter(name => name.endsWith('.html'))) {
  const dom = new JSDOM(await fs.readFile(name, 'utf8'));
  const document = dom.window.document;
  for (const image of document.querySelectorAll('img')) {
    const source = image.getAttribute('src')?.replace(/^\.\//,'');
    const data = images.get(source) || [...images.values()].find(data => data.variants.some(v => v.target === source));
    if (data) {
      image.src = data.variants.at(-1).target;
      image.setAttribute('srcset', data.variants.map(v => `${v.target} ${v.width}w`).join(', '));
      image.setAttribute('sizes', image.closest('.tour-card, .gallery-item') ? '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw' : '(min-width: 1024px) 50vw, 100vw');
      image.width = data.width; image.height = data.height;
    } else if (source && !source.startsWith('http')) {
      const data = await sharp(source).metadata();
      image.width = data.width; image.height = data.height;
    }
    image.setAttribute('decoding','async');
    if (!image.closest('header, #offcanvas')) image.setAttribute('loading','lazy');
  }
  const hero = document.querySelector('main > section')?.querySelector('img');
  if (hero) {hero.setAttribute('loading', 'eager'); hero.setAttribute('fetchpriority', 'high'); hero.sizes = '100vw';}
  // Replace CSS hero references and social previews with their optimized variant.
  let output = dom.serialize();
  for (const [source, data] of images) {
    const target = data.variants.at(-1).target;
    output = output.replaceAll(`url('./${source}')`, `url('${target}')`).replaceAll(`url('${source}')`, `url('${target}')`);
    output = output.replaceAll(`https://www.happycapetours.com/${source}`, `https://www.happycapetours.com/${target}`);
  }
  if (name === 'index.html' && !output.includes('rel="preload"')) {
    const hero = images.get('images/hero-bg.jpg').variants.at(-1).target;
    output = output.replace('</head>', `<link rel="preload" as="image" href="${hero}" fetchpriority="high"></head>`);
    // The original 4K autoplay clip was hidden behind its fallback image. Keep the local hero without a large automatic download.
    output = output.replace(/<video\b[\s\S]*?<\/video>/, '');
  }
  await fs.writeFile(name, output);
}
await fs.writeFile('assets/image-manifest.json',JSON.stringify(Object.fromEntries(images),null,2)+'\n');
console.log(`Optimized ${images.size} source images: ${(before/1e6).toFixed(2)} MB → ${(after/1e6).toFixed(2)} MB for largest variants.`);
