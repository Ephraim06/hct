/* The public collection contains only published uploads from the gallery service. */
(async () => {
  const grid = document.getElementById('galleryGrid');
  const status = document.getElementById('galleryStatus');
  const base = window.HCT_BACKEND?.apiBaseUrl;
  if (!grid || !status) return;
  if (!base) {status.textContent = 'Our gallery is temporarily unavailable. Please try again later.';return;}
  grid.setAttribute('aria-busy', 'true');
  status.textContent = 'Loading photos…';
  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/gallery`, {signal: AbortSignal.timeout(15000),cache:'no-store'});
    if (!response.ok) throw new Error('Gallery unavailable');
    const {images} = await response.json();
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
    status.hidden = false;
    status.textContent = 'Our gallery is temporarily unavailable. Please try again later.';
  } finally {grid.removeAttribute('aria-busy');}
})();
