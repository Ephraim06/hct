/* Uploaded photos extend the static gallery; network failures preserve existing photos. */
(async () => {
  const grid = document.querySelector('.gallery-item')?.parentElement;
  const base = window.HCT_BACKEND?.apiBaseUrl;
  if (!grid || !base) return;
  const status = document.createElement('p');
  status.className = 'text-sm text-gray-600 mt-4';
  status.setAttribute('role', 'status');
  grid.after(status);
  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/gallery`, {signal: AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error('Gallery unavailable');
    const {images} = await response.json();
    const fragment = document.createDocumentFragment();
    for (const photo of images) {
      if (document.querySelector(`[data-upload-id="${CSS.escape(photo.id)}"]`)) continue;
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
    // Preserve server order while placing uploads before the original collection.
    grid.prepend(fragment);
    document.dispatchEvent(new Event('hct:gallery-added'));
  } catch {
    status.textContent = 'Additional photos could not be loaded. You can still browse the photos shown here.';
  }
})();
