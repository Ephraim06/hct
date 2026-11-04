/* The public collection contains only published uploads from the gallery service. */
(async () => {
  const grid = document.getElementById('galleryGrid');
  const status = document.getElementById('galleryStatus');
  const base = window.HCT_BACKEND?.apiBaseUrl;
  if (!grid || !status) return;
  if (!base) {status.textContent = 'Our gallery is temporarily unavailable. Please try again later.';return;}
  grid.setAttribute('aria-busy', 'true');
  status.textContent = 'Loading photos…';status.classList.add('gallery-loading-mark');
  for(let i=0;i<6;i++){const skeleton=document.createElement('div');skeleton.className='gallery-skeleton';skeleton.setAttribute('aria-hidden','true');grid.append(skeleton);}
  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/gallery`, {signal: AbortSignal.timeout(15000),cache:'no-store'});
    if (!response.ok) throw new Error('Gallery unavailable');
    const {images,hero} = await response.json();
    const cover=document.getElementById('galleryHeroImage');if(hero&&cover){cover.hidden=false;cover.alt=hero.alt;cover.onload=()=>cover.classList.add('is-ready');cover.onerror=()=>{cover.hidden=true;};cover.src=base.replace(/\/$/,'')+hero.src;cover.width=hero.width;cover.height=hero.height;}
    const fragment = document.createDocumentFragment();
    for (const photo of images) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'gallery-item';
      button.dataset.category = photo.category; button.dataset.uploadId = photo.id;
      const image = document.createElement('img');
      image.src = `${base.replace(/\/$/, '')}${photo.src}`;
      image.alt = photo.alt; image.dataset.caption = photo.caption;
      image.width = photo.width; image.height = photo.height;
      image.className = 'w-full h-full'; image.loading = 'lazy'; image.decoding = 'async';
      button.append(image); fragment.append(button);
    }
    grid.replaceChildren(fragment);
    grid.dataset.loaded = 'true';
    document.dispatchEvent(new Event('hct:gallery-added'));
  } catch {
    grid.querySelectorAll('.gallery-skeleton').forEach(item=>item.remove());
    status.hidden = false;
    status.textContent = 'Our gallery is temporarily unavailable. Please try again later.';
  } finally {grid.removeAttribute('aria-busy');status.classList.remove('gallery-loading-mark');}
})();
