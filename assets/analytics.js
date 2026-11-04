/* First-party aggregate analytics. No form content, query strings, IPs or account identifiers. */
(()=>{
 const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
 const excluded=/\/admin(\.html)?\/?$/.test(location.pathname);
 const account=/\/account(\.html)?\/?$/.test(location.pathname);
 const slugs=['cape-point-penguins','cape-point-penguins-private-tour','cape-agulhas','chapmans-peak','capewinelands-stellenbosch','robben-island','safari-day-tour','whale-watching'];
 const today=()=>new Date().toISOString().slice(0,10);
 let queue=[],timer,session,visitor,source='direct';
 const fallback=new Map();
 const store={get(key){if(fallback.has(key))return fallback.get(key);try{return localStorage.getItem(key);}catch{return null;}},set(key,value){try{localStorage.setItem(key,value);fallback.delete(key);}catch{fallback.set(key,value);}},remove(key){fallback.delete(key);try{localStorage.removeItem(key);}catch{}}};
 const optedOut=()=>store.get('hct-analytics-optout')==='1';
 const disabled=()=>local||excluded||optedOut()||store.get('hct-admin-exclude')==='1'||navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true||/bot|spider|crawler|headless|preview|lighthouse/i.test(navigator.userAgent);
 function tourFrom(href){try{const u=new URL(href,location.href);if(u.origin!==location.origin)return null;const slug=u.pathname.split('/').pop().replace(/\.html$/,'');return slugs.includes(slug)?slug:null;}catch{return null;}}
 function identity(){const now=Date.now();try{session=JSON.parse(store.get('hct-visit')||'null');visitor=JSON.parse(store.get('hct-visitor')||'null');}catch{session=null;visitor=null;}if(!visitor||visitor.day!==today())visitor={id:crypto.randomUUID(),day:today()};if(!session||now-session.last>1800000||session.day!==today()){let ref;try{ref=new URL(document.referrer);}catch{}source=ref&&ref.origin!==location.origin?ref.hostname.toLowerCase():'direct';session={id:crypto.randomUUID(),last:now,day:today(),source};}source=session.source||'direct';session.last=now;store.set('hct-visit',JSON.stringify(session));store.set('hct-visitor',JSON.stringify(visitor));}
 async function flush(){clearTimeout(timer);if(disabled()){queue=[];return;}const base=window.HCT_BACKEND?.apiBaseUrl?.replace(/\/$/,'');if(!base||!queue.length)return;const batch=queue.splice(0,20);try{const response=await fetch(base+'/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({events:batch}),keepalive:true,signal:AbortSignal.timeout(8000)});if(!response.ok&&response.status>=500)queue.unshift(...batch);}catch{queue.unshift(...batch);}queue=queue.slice(0,40);}
 function track(kind,tourSlug=null){if(disabled()||(account&&kind!=='tour_save'))return;identity();const path=location.pathname==='/'?'/index.html':location.pathname;queue.push({id:crypto.randomUUID(),sessionId:session.id,visitorId:visitor.id,kind,path,tourSlug:tourSlug||tourFrom(location.href),source,device:matchMedia('(max-width: 767px)').matches?'mobile':matchMedia('(max-width: 1023px)').matches?'tablet':'desktop'});if(queue.length>=10)void flush();else{clearTimeout(timer);timer=setTimeout(flush,1000);}}
 window.HCT_ANALYTICS={track,optedOut,setOptOut(value){store.set('hct-analytics-optout',value?'1':'0');if(value){queue=[];store.remove('hct-visit');store.remove('hct-visitor');}updatePreference();}};
 function updatePreference(){const button=document.getElementById('analytics-preference');if(button){button.textContent=optedOut()?'Enable anonymous analytics':'Disable anonymous analytics';button.setAttribute('aria-pressed',String(optedOut()));}}
 document.getElementById('analytics-preference')?.addEventListener('click',()=>window.HCT_ANALYTICS.setOptOut(!optedOut()));updatePreference();
 document.addEventListener('click',event=>{const a=event.target.closest?.('a[href]');if(!a)return;const href=a.getAttribute('href');let url;try{url=new URL(href,location.href);}catch{return;}const tour=tourFrom(href);if(tour)track('tour_click',tour);else if(url.hostname==='wa.me'||url.hostname==='api.whatsapp.com')track('whatsapp');else if(url.protocol==='tel:')track('phone');else if(url.protocol==='mailto:')track('email');else if(url.origin===location.origin&&/\/contact\.html$/.test(url.pathname))track('enquiry_click');});
 document.addEventListener('hct:enquiry-accepted',event=>track('enquiry',event.detail?.tourSlug||null));
 document.addEventListener('hct:tour-saved',event=>track('tour_save',event.detail?.slug||null));
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')void flush();});window.addEventListener('pagehide',()=>void flush());
 if(!disabled())track('page_view');
})();
