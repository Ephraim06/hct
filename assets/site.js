/* Core interactions intentionally have no third-party runtime dependencies. */
(() => {
  'use strict';
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  const focusables = root => all('a[href], summary, button:not([disabled]), input:not([disabled]), select, textarea, [tabindex="0"]', root).filter(el => !el.hidden && el.getClientRects().length);
  let activeDialog = null;
  let returnFocus = null;
  let previousOverflow = '';
  function openDialog(element, close) {
    returnFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    activeDialog = {element, close};
    document.body.style.overflow = 'hidden';
    // Prevent keyboard and assistive technology from entering the background.
    let branch = element;
    while (branch.parentElement) {
      [...branch.parentElement.children].forEach(el => {
        if (el !== branch && el.tagName !== 'SCRIPT' && !el.classList.contains('menu-backdrop')) {
          el.dataset.dialogInert = el.inert ? 'existing' : 'added';
          el.inert = true;
        }
      });
      if (branch.parentElement === document.body) break;
      branch = branch.parentElement;
    }
    (focusables(element)[0] || element).focus();
  }
  function closeDialog() {
    all('[data-dialog-inert]').forEach(el => {
      el.inert = el.dataset.dialogInert === 'existing';
      delete el.dataset.dialogInert;
    });
    document.body.style.overflow = previousOverflow;
    activeDialog = null;
    returnFocus?.focus();
  }
  document.addEventListener('keydown', event => {
    if (!activeDialog) return;
    if (event.key === 'Escape') { event.preventDefault(); activeDialog.close(); return; }
    if (event.key !== 'Tab') return;
    const items = focusables(activeDialog.element);
    const first = items[0], last = items.at(-1);
    if (!first) {event.preventDefault(); return;}
    if (event.shiftKey && (document.activeElement === first || !activeDialog.element.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !activeDialog.element.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  });

  const menu = document.getElementById('offcanvas');
  if (menu) {
    const toggles = all('#menuToggle, #footerMenuToggle');
    const backdrop = document.createElement('div');
    backdrop.className = 'menu-backdrop'; backdrop.hidden = true;
    document.body.append(backdrop);
    const closeMenu = () => {
      menu.classList.remove('offcanvas-open'); menu.inert = true;
      menu.setAttribute('aria-hidden', 'true'); backdrop.hidden = true;
      toggles.forEach(el => el.setAttribute('aria-expanded', 'false'));
      closeDialog();
    };
    toggles.forEach(el => {
      el.setAttribute('aria-controls', 'offcanvas'); el.setAttribute('aria-expanded', 'false');
      el.addEventListener('click', () => {
        menu.inert = false; menu.removeAttribute('aria-hidden');
        menu.classList.add('offcanvas-open'); backdrop.hidden = false;
        toggles.forEach(button => button.setAttribute('aria-expanded', 'true'));
        openDialog(menu, closeMenu);
      });
    });
    document.getElementById('closeOffcanvas')?.addEventListener('click', closeMenu);
    backdrop.addEventListener('click', closeMenu);
    all('a', menu).forEach(link => link.addEventListener('click', closeMenu));
    const desktop = matchMedia('(min-width: 768px)');
    desktop.addEventListener('change', () => { if (desktop.matches && menu.classList.contains('offcanvas-open')) closeMenu(); });
  }

  all('.faq-trigger').forEach((button, index) => {
    const item = button.closest('.faq-item');
    const answer = item.querySelector('.faq-answer');
    if (!answer) return;
    answer.id ||= `faq-answer-${index}`;
    button.setAttribute('aria-controls', answer.id);
    const sync = () => {
      const expanded = item.classList.contains('open');
      button.setAttribute('aria-expanded', String(expanded)); answer.hidden = !expanded;
    };
    sync(); button.addEventListener('click', () => {item.classList.toggle('open'); sync();});
  });

  let cards = all('.tour-card[data-category], .gallery-item[data-category]');
  let currentCategory = 'all';
  const filters = all('.filter-btn');
  function filter(category) {
    currentCategory = category;
    cards.forEach(card => {card.hidden = category !== 'all' && !card.dataset.category.split(/\s+/).includes(category);});
    filters.forEach(button => {
      const selected = button.dataset.filter === category;
      button.setAttribute('aria-pressed', String(selected));
      ['active', 'bg-amber-400', 'text-gray-900', 'border-amber-400'].forEach(name => button.classList.toggle(name, selected));
    });
    const count = document.getElementById('visibleCount');
    if (count) count.textContent = String(cards.filter(card => !card.hidden).length);
    const photoLabel=document.getElementById('galleryCountLabel');
    if(photoLabel)photoLabel.textContent=cards.filter(card=>!card.hidden).length===1?'photo':'photos';
    const galleryStatus = document.getElementById('galleryStatus');
    if (galleryStatus && document.getElementById('galleryGrid')?.dataset.loaded === 'true') {
      const visible = cards.filter(card => !card.hidden).length;
      galleryStatus.hidden = visible > 0;
      galleryStatus.textContent = cards.length ? 'No photos in this category yet.' : 'New adventures are on their way. Check back soon for photos from our tours.';
    }
  }
  document.addEventListener('hct:gallery-added', () => {
    cards = all('.tour-card[data-category], .gallery-item[data-category]'); filter(currentCategory);
  });
  filters.forEach(button => button.addEventListener('click', () => filter(button.dataset.filter)));
  if (filters.length) {
    const count = document.getElementById('visibleCount');
    count?.parentElement.setAttribute('aria-live', 'polite');
    filter('all');
  }

  const lightbox = document.getElementById('lightbox');
  if (lightbox) {
    let items = all('.gallery-item');
    let selected = null;
    const image = document.getElementById('lightboxImg');
    const caption = document.getElementById('lightboxCaption');
    function show(item) {
      selected = item;
      const source = item.querySelector('img');
      image.src = source.currentSrc || source.src;
      image.alt = source.alt; image.width = source.width; image.height = source.height;
      caption.textContent = source.dataset.caption || source.alt;
    }
    function close() {lightbox.hidden = true; lightbox.classList.remove('active'); closeDialog();}
    function move(delta) {
      const visible = items.filter(item => !item.hidden);
      if (visible.length) show(visible[(visible.indexOf(selected) + delta + visible.length) % visible.length]);
    }
    caption.setAttribute('aria-live', 'polite');
    function bindItem(item) {
      item.setAttribute('aria-label', `View photo: ${item.querySelector('img').alt}`);
      item.addEventListener('click', () => {
        show(item); lightbox.hidden = false; lightbox.classList.add('active'); openDialog(lightbox, close);
      });
    }
    items.forEach(bindItem);
    document.addEventListener('hct:gallery-added', () => {
      const updated = all('.gallery-item'); updated.filter(item => !items.includes(item)).forEach(bindItem); items = updated;
    });
    document.getElementById('lightboxClose').addEventListener('click', close);
    document.getElementById('lightboxPrev').addEventListener('click', () => move(-1));
    document.getElementById('lightboxNext').addEventListener('click', () => move(1));
    lightbox.addEventListener('click', event => {if (event.target === lightbox) close();});
    document.addEventListener('keydown', event => {
      if (lightbox.hidden) return;
      if (event.key === 'ArrowLeft') {event.preventDefault(); move(-1);}
      if (event.key === 'ArrowRight') {event.preventDefault(); move(1);}
    });
  }

  if(document.readyState!=='complete'){
    const progress=document.createElement('div');progress.className='hct-page-progress';progress.setAttribute('role','progressbar');progress.setAttribute('aria-label','Loading page');document.body.append(progress);
    const finish=()=>{progress.classList.add('is-done');setTimeout(()=>progress.remove(),300);};window.addEventListener('load',finish,{once:true});setTimeout(finish,4000);
  }
  const form = document.getElementById('contactForm');
  if (form) {
    const tour = form.elements.namedItem('tour');
    const selectedTour = new URLSearchParams(location.search).get('tour');
    if (all('option', tour).some(option => option.value === selectedTour)) tour.value = selectedTour;
    const date = document.getElementById('travelDate');
    // A date-only field uses the visitor's local calendar date, not UTC.
    const now = new Date();
    date.min = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const button = document.getElementById('submitBtn');
    const status = document.getElementById('formStatus');
    let pending = false, submissionId = null, submissionFingerprint = '';
    const originalButton = button.innerHTML;
    const received=new URLSearchParams(location.search).get('received');if(received&&/^[0-9a-f]{8}$/i.test(received)){status.className='form-feedback is-success';status.textContent='Thank you! Your enquiry has been received. Reference: '+received.toUpperCase()+'.';}
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (pending || !form.reportValidity()) return;
      pending = true; button.disabled = true; form.setAttribute('aria-busy', 'true');
      status.removeAttribute('data-success');status.className='form-feedback is-sending'; status.textContent = 'Sending your enquiry…';
      button.innerHTML='<span class="hct-button-spinner" aria-hidden="true"></span> Sending…';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      try {
        const fields = new FormData(form);
        const payload = {firstName:String(fields.get('first-name')||''),lastName:String(fields.get('last-name')||''),email:String(fields.get('email')||''),phone:String(fields.get('mobile-number')||''),tour:String(fields.get('tour')||''),travelDate:String(fields.get('travel-date')||''),partySize:Number(fields.get('party-size')),message:String(fields.get('message')||''),website:String(fields.get('website')||'')};
        const fingerprint=JSON.stringify(payload);if(!submissionId||fingerprint!==submissionFingerprint){submissionId=crypto.randomUUID();submissionFingerprint=fingerprint;}
        const base=window.HCT_BACKEND?.apiBaseUrl?.replace(/\/$/,'');if(!base)throw new Error('Enquiry service unavailable');
        const response = await fetch(base+'/enquiries', {method:'POST',body:JSON.stringify({...payload,id:submissionId}),headers:{Accept:'application/json','Content-Type':'application/json'},signal:controller.signal});
        const result=await response.json();if(!response.ok||!result.accepted)throw new Error(result.error||'Submission rejected');
        // Analytics receives only a canonical tour slug, never the form contents.
        const selection=String(tour?.value||'').toLowerCase();
        const tourSlug=({'cape point & penguins':'cape-point-penguins','cape of good hope & penguins':'cape-point-penguins','private cape point & penguins':'cape-point-penguins-private-tour','private cape of good hope & penguins':'cape-point-penguins-private-tour','cape agulhas':'cape-agulhas',"chapman’s peak":'chapmans-peak',"chapman's peak":'chapmans-peak','cape winelands':'capewinelands-stellenbosch','robben island & township':'robben-island','safari day tour':'safari-day-tour','whale watching hermanus':'whale-watching'})[selection]||null;
        document.dispatchEvent(new CustomEvent('hct:enquiry-accepted',{detail:{tourSlug}}));
        // Clear private fields only after the receiving service accepts the request.
        form.reset();
        if (selectedTour) tour.value = selectedTour;
        status.dataset.success = '';status.className='form-feedback is-success';
        submissionId=null;submissionFingerprint='';
        status.textContent = `Thank you! Your enquiry has been received. Reference: ${String(result.reference||'').slice(0,8).toUpperCase()}.`;
      } catch (error) {
        status.className='form-feedback is-error';status.textContent = 'We couldn’t confirm receipt. Please retry—your details are still here.';
      } finally {
        clearTimeout(timeout); pending = false; button.disabled = false;button.innerHTML=originalButton; form.removeAttribute('aria-busy'); status.focus();
      }
    });
  }

  if (document.querySelector('.marquee')) {
    const control = document.createElement('button'); control.type = 'button'; control.className = 'motion-toggle';
    control.textContent = 'Play scrolling highlights'; control.setAttribute('aria-pressed', 'false');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    control.addEventListener('click', () => {
      const enabled = !document.body.classList.contains('motion-enabled') && !reducedMotion.matches;
      document.body.classList.toggle('motion-enabled', enabled);
      control.textContent = enabled ? 'Pause scrolling highlights' : 'Play scrolling highlights';
      control.setAttribute('aria-pressed', String(enabled));
    });
    document.querySelector('.marquee').parentElement.after(control);
  }

  const languageSwitch = document.querySelector('.language-switch');
  if (languageSwitch) {
    const mobile = matchMedia('(max-width: 767px)');
    const placeLanguage = () => {
      const slot = document.querySelector(mobile.matches ? '.language-mobile-slot' : '.language-desktop-slot');
      if (slot) {languageSwitch.open = false; slot.append(languageSwitch);}
    };
    placeLanguage();
    mobile.addEventListener('change', placeLanguage);
    document.addEventListener('click', event => {
      if (!languageSwitch.contains(event.target)) languageSwitch.open = false;
    });
    languageSwitch.addEventListener('keydown', event => {
      if (event.key === 'Escape' && languageSwitch.open) {
        event.preventDefault(); event.stopPropagation(); languageSwitch.open = false;
        languageSwitch.querySelector('summary').focus();
      }
    });
  }

  // Translation is optional: a failed provider must never break core interactions.
  if (document.getElementById('google_translate_element')) {
    window.googleTranslateElementInit = () => {
      if (!window.google?.translate) return;
      const host = document.getElementById('google_translate_element');
      host.replaceChildren();
      new window.google.translate.TranslateElement({pageLanguage: 'en', autoDisplay: false}, 'google_translate_element');
      // The provider inserts the native select asynchronously.
      const labelSelect = () => {
        const select = host.querySelector('select');
        if (select) {select.setAttribute('aria-label', 'Translate this website'); observer.disconnect();}
      };
      const observer = new MutationObserver(labelSelect);
      observer.observe(host, {childList: true, subtree: true});
      labelSelect();
    };
    const script = document.createElement('script'); script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'; script.async = true;
    script.onerror = () => {
      const host = document.getElementById('google_translate_element');
      host.textContent = 'Translation unavailable';
      host.classList.add('language-loading');
    };
    document.body.append(script);
  }
})();
