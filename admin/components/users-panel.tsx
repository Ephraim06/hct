import {Disclosure} from './ui/disclosure';
import {Loader} from './feedback';
import React,{useEffect,useState} from 'react';
import {api} from '../lib/auth';
import {Button} from './ui/button';
import {Input} from './ui/input';
type User={id:string;name:string;email:string;verified:boolean;is_admin:boolean;saved_tours:{slug:string;title:string;href:string}[]};
export function UsersPanel(){
 const [users,setUsers]=useState<User[]>([]),[search,setSearch]=useState(''),[page,setPage]=useState(1),[total,setTotal]=useState(0),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;setLoading(true);const timer=setTimeout(()=>{api(`/admin/users?search=${encodeURIComponent(search)}&page=${page}`).then(data=>{if(active){setUsers(data.users);setTotal(data.total);setError('');}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});},250);return()=>{active=false;clearTimeout(timer);};},[search,page]);
 return <section className="p-5 md:p-8 space-y-5"><h2 className="font-serif text-3xl font-bold">Users &amp; saved tours</h2><p>See your travellers and the adventures they’re interested in.</p><Input aria-label="Search users" placeholder="Search by name or email" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>{loading?<Loader label="Loading travellers…"/>:<p role="status">{total} accounts</p>}<p role="alert">{error}</p>{!loading&&users.map(user=><article key={user.id} className="rounded-xl border bg-white p-5 space-y-2"><h3 className="font-semibold">{user.name}</h3><p className="break-all">{user.email}</p><p className="text-sm text-muted-foreground">{user.is_admin?'Administrator':'Traveller'} · {user.verified?'Email verified':'Email unverified'}</p><Disclosure className="" title={`${user.saved_tours.length} saved tours`}>{user.saved_tours.length?<ul className="space-y-2 mt-3">{user.saved_tours.map(tour=><li key={tour.slug}><a className="underline" href={tour.href}>{tour.title}</a></li>)}</ul>:<p className="mt-3">No tours saved yet.</p>}</Disclosure></article>)}<div className="flex items-center gap-4"><Button variant="outline" disabled={page===1||loading} onClick={()=>setPage(page-1)}>Previous</Button><span>Page {page}</span><Button variant="outline" disabled={page*25>=total||loading} onClick={()=>setPage(page+1)}>Next</Button></div></section>;
}
