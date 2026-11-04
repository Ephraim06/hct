import {Loader} from './components/feedback';
import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {auth,api} from './lib/auth';
import {AuthForm} from './components/auth-form';
import {Button} from './components/ui/button';
import {findTour} from '../backend/tours';
type Tour={slug:string;title:string;href:string;image:string};
function Traveller(){
 const [user,setUser]=useState<{name:string;isAdmin:boolean}|null>(null),[tours,setTours]=useState<Tour[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState('');
 useEffect(()=>{document.body.classList.toggle('admin-signed-in',Boolean(user));return()=>document.body.classList.remove('admin-signed-in');},[user]);
 async function load(){const identity=await api('/account/me');const slug=new URLSearchParams(location.search).get('save');if(slug&&findTour(slug)){await api(`/account/saved-tours/${slug}`,{method:'POST'});document.dispatchEvent(new CustomEvent('hct:tour-saved',{detail:{slug}}));const url=new URL(location.href);url.searchParams.delete('save');history.replaceState(null,'',url);}const data=await api('/account/saved-tours');setTours(data.tours);setUser(identity.user);setError('');}
 useEffect(()=>{auth?.getSession().then(async({data})=>{if(data?.user)await load();}).catch(e=>setError(e.message)).finally(()=>setLoading(false));if(!auth)setLoading(false);},[]);
 async function remove(slug:string){setBusy(slug);try{await api(`/account/saved-tours/${slug}`,{method:'DELETE'});await load();}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 if(loading)return <Loader full label="Finding your adventures…"/>;
 if(!user)return <>{error&&<p className="admin-auth-notice" role="alert">{error}</p>}<AuthForm audience="traveller" onLogin={load}/></>;
 return <div className="traveller-dashboard"><div className="flex flex-wrap justify-between gap-4"><div><a href="index.html" className="font-bold">Happy Cape Tours</a><h2 className="font-serif text-3xl font-bold mt-5">Your saved adventures</h2><p className="mt-2">Welcome, {user.name}. Keep your favourite Cape tours together.</p></div><div className="flex gap-3 items-start">{user.isAdmin&&<a href="admin.html" className="underline">Administration</a>}<Button variant="outline" onClick={async()=>{await auth?.signOut();setUser(null);setTours([]);}}>Sign out</Button></div></div><p role="alert" className="text-red-700 my-4">{error}</p>{tours.length?<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">{tours.map(tour=><article key={tour.slug} className="rounded-2xl bg-white border overflow-hidden"><a href={tour.href}><img src={tour.image} alt={tour.title} className="w-full aspect-[4/3] object-cover"/><h3 className="font-bold p-5">{tour.title}</h3></a><div className="px-5 pb-5"><Button variant="outline" disabled={busy===tour.slug} onClick={()=>remove(tour.slug)}>{busy===tour.slug?'Removing…':'Remove from saved'}</Button></div></article>)}</div>:<p className="my-10">No saved tours yet. Explore our tours and tap Save tour to start planning.</p>}<a href="tours.html" className="inline-block mt-8 rounded-full bg-amber-400 px-6 py-3 font-semibold">Explore tours →</a></div>;
}
const root=document.getElementById('account-root');if(root)createRoot(root).render(<Traveller/>);
