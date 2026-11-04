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
  function validationTarget(field){return field._flatpickr?.altInput||(field.tagName==='SELECT'?field.parentElement?.querySelector('.hct-select-trigger'):null)||field;}
  function validateForm(form){
    form.querySelectorAll('.hct-field-error').forEach(el=>el.remove());form.querySelectorAll('[aria-invalid="true"]').forEach(el=>{el.removeAttribute('aria-invalid');el.removeAttribute('aria-errormessage');});
    const missingDates=[...form.querySelectorAll('input[data-hct-date]')].filter(field=>field.required&&!field.value);
    if(form.checkValidity()&&!missingDates.length)return true;
    let first=null;for(const field of form.querySelectorAll('input,select,textarea')){const missingDate=missingDates.includes(field);if(!missingDate&&(!field.willValidate||field.validity.valid))continue;const target=validationTarget(field);const error=document.createElement('span');error.className='hct-field-error';error.id='field-error-'+crypto.randomUUID();error.setAttribute('role','alert');error.textContent=missingDate?'Choose a date.':field.validity.valueMissing?'Please complete this field.':field.validity.typeMismatch?'Enter a valid email address.':field.validity.rangeUnderflow?`Enter at least ${field.min}.`:field.validity.rangeOverflow?`Enter no more than ${field.max}.`:field.validity.tooShort?`Use at least ${field.minLength} characters.`:'Please check this value.';field.setAttribute('aria-invalid','true');field.setAttribute('aria-errormessage',error.id);target.setAttribute('aria-invalid','true');target.setAttribute('aria-errormessage',error.id);(target.closest('.auth-password,.hct-date-control,.hct-public-select')||target).after(error);first ||=target;}
    first?.focus();return false;
  }
  document.addEventListener('invalid',event=>event.preventDefault(),true);
  document.addEventListener('submit',event=>{if(event.target instanceof HTMLFormElement&&!validateForm(event.target)){event.preventDefault();event.stopImmediatePropagation();}},true);
  function disableNativeValidation(root=document){root.querySelectorAll('form').forEach(form=>{form.noValidate=true;});}disableNativeValidation();
  new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node instanceof HTMLElement){if(node.tagName==='FORM')node.noValidate=true;disableNativeValidation(node);}}))).observe(document.body,{subtree:true,childList:true});
  const clearFieldError=event=>{const field=event.target;if(field.validity?.valid){const target=validationTarget(field);document.getElementById(field.getAttribute('aria-errormessage')||target.getAttribute('aria-errormessage'))?.remove();for(const el of[field,target]){el.removeAttribute('aria-invalid');el.removeAttribute('aria-errormessage');}}};document.addEventListener('input',clearFieldError,true);document.addEventListener('change',clearFieldError,true);

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
    const submissionModal=document.createElement('div');submissionModal.id='enquirySubmissionModal';submissionModal.className='enquiry-submit-modal';submissionModal.hidden=true;submissionModal.tabIndex=-1;submissionModal.setAttribute('role','dialog');submissionModal.setAttribute('aria-modal','true');submissionModal.setAttribute('aria-labelledby','enquiryModalTitle');submissionModal.setAttribute('aria-describedby','enquiryModalMessage');
    submissionModal.innerHTML='<div class="enquiry-submit-card"><div class="enquiry-submit-symbol" aria-hidden="true"><span class="enquiry-submit-ring"></span><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m4 12 5 5L20 6"/></svg></div><span class="enquiry-submit-eyebrow">HAPPY CAPE TOURS</span><h2 id="enquiryModalTitle"></h2><p id="enquiryModalMessage" role="status" aria-live="polite"></p><strong class="enquiry-submit-reference" hidden></strong><button type="button" class="enquiry-submit-done" hidden>Done</button></div>';
    document.body.append(submissionModal);
    const modalTitle=submissionModal.querySelector('h2'),modalMessage=submissionModal.querySelector('#enquiryModalMessage'),modalReference=submissionModal.querySelector('strong'),modalDone=submissionModal.querySelector('button');
    function dismissSubmission(){if(pending)return;submissionModal.hidden=true;closeDialog();}
    modalDone.addEventListener('click',dismissSubmission);submissionModal.addEventListener('click',event=>{if(event.target===submissionModal)dismissSubmission();});
    function showSubmission(state,title,message,reference=''){
      submissionModal.dataset.state=state;modalTitle.textContent=title;modalMessage.textContent=message;modalReference.hidden=!reference;modalReference.textContent=reference?'Reference '+reference:'';modalDone.hidden=state==='loading';modalDone.textContent=state==='error'?'Back to form':'Done';submissionModal.setAttribute('aria-busy',String(state==='loading'));
      if(submissionModal.hidden){submissionModal.hidden=false;openDialog(submissionModal,dismissSubmission);}
      if(state!=='loading')modalDone.focus();
    }
    const originalButton = button.innerHTML;
    const received=new URLSearchParams(location.search).get('received');if(received&&/^[0-9a-f]{8}$/i.test(received)){status.className='form-feedback is-success';status.textContent='Thank you! Your enquiry has been received. Reference: '+received.toUpperCase()+'.';}
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (pending || !validateForm(form)) return;
      pending = true; button.disabled = true; form.setAttribute('aria-busy', 'true');
      showSubmission('loading','Sending your enquiry','Saving your details and sending your message…');
      status.removeAttribute('data-success');status.className='form-feedback is-sending'; status.textContent = 'Sending your enquiry…';
      button.innerHTML='<span class="hct-button-spinner" aria-hidden="true"></span> Sending…';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      try {
        const fields = new FormData(form);
        const payload = {firstName:String(fields.get('first-name')||''),lastName:String(fields.get('last-name')||''),email:String(fields.get('email')||''),phone:String(fields.get('mobile-number')||''),tour:String(fields.get('tour')||''),travelDate:String(fields.get('travel-date')||''),partySize:Number(fields.get('party-size')),message:String(fields.get('message')||'')};
        const fingerprint=JSON.stringify(payload);if(!submissionId||fingerprint!==submissionFingerprint){submissionId=crypto.randomUUID();submissionFingerprint=fingerprint;}
        const base=window.HCT_BACKEND?.apiBaseUrl?.replace(/\/$/,'');if(!base)throw new Error('Enquiry service unavailable');
        const response = await fetch(base+'/enquiries', {method:'POST',body:JSON.stringify({...payload,id:submissionId}),headers:{Accept:'application/json','Content-Type':'application/json'},signal:controller.signal});
        const result=await response.json();if(!response.ok||!result.accepted||result.stored!==true)throw Object.assign(new Error('Submission rejected'),{displayMessage:typeof result.error==='string'?result.error.slice(0,300):'We couldn’t confirm that your enquiry was saved. Your details are still here.'});
        // Analytics receives only a canonical tour slug, never the form contents.
        const selection=String(tour?.value||'').toLowerCase();
        const tourSlug=({'cape point & penguins':'cape-point-penguins','cape of good hope & penguins':'cape-point-penguins','private cape point & penguins':'cape-point-penguins-private-tour','private cape of good hope & penguins':'cape-point-penguins-private-tour','cape agulhas':'cape-agulhas',"chapman’s peak":'chapmans-peak',"chapman's peak":'chapmans-peak','cape winelands':'capewinelands-stellenbosch','robben island & township':'robben-island','safari day tour':'safari-day-tour','whale watching hermanus':'whale-watching'})[selection]||null;
        document.dispatchEvent(new CustomEvent('hct:enquiry-accepted',{detail:{tourSlug}}));
        // Clear private fields only after the receiving service accepts the request.
        form.reset();
        if (selectedTour) tour.value = selectedTour;
        status.dataset.success = '';status.className='form-feedback is-success';
        submissionId=null;submissionFingerprint='';
        const reference=String(result.reference||'').slice(0,8).toUpperCase();
        status.textContent = `Thank you! Your enquiry has been received. Reference: ${reference}.`;
        showSubmission('success',result.notification==='sent'?'Message sent!':'Enquiry received!','Thank you. We’ll be in touch about your enquiry.',reference);
      } catch (error) {
        const message=error.displayMessage||'We couldn’t confirm receipt. Please retry—your details are still here.';status.className='form-feedback is-error';status.textContent=message;
        showSubmission('error','Let’s try that again',message);
      } finally {
        clearTimeout(timeout); pending = false; button.disabled = false;button.innerHTML=originalButton; form.removeAttribute('aria-busy'); if(submissionModal.hidden)status.focus();
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
