import React, {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {uploadImages,type UploadItem} from './lib/gallery-uploads';
import {auth,api,apiBase} from './lib/auth';
import {AuthForm} from './components/auth-form';
import {UsersPanel} from './components/users-panel';
import {Images, Upload, LogOut, ExternalLink, RefreshCw, Eye, EyeOff, Pencil, MapPin} from 'lucide-react';
import {Button} from './components/ui/button';
import {Input} from './components/ui/input';
import {Label} from './components/ui/label';
import {Card,CardContent} from './components/ui/card';
import {Badge} from './components/ui/badge';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './components/ui/dialog';
import {Sidebar,SidebarProvider,SidebarContent,SidebarFooter,SidebarHeader,SidebarInset,SidebarTrigger,SidebarMenu,SidebarMenuItem,SidebarMenuButton,SidebarGroup} from './components/ui/sidebar';

type Photo={id:string;src:string;preview:string;caption:string;alt:string;category:string;sortOrder:number;published:boolean;width:number;height:number};
const categories=[['landscape','Landscape'],['wildlife','Wildlife'],['people','People'],['culture','Culture']];
function PhotoForm({photo,onSaved,onCancel,onBusyChange}:{photo:Photo|null;onSaved:()=>Promise<void>;onCancel:()=>void;onBusyChange:(busy:boolean)=>void}){
 const [caption,setCaption]=useState(photo?.caption||''),[category,setCategory]=useState(photo?.category||'landscape');
 const [sortOrder,setSortOrder]=useState(photo?.sortOrder||0),[published,setPublished]=useState(photo?.published||false),[items,setItems]=useState<UploadItem[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);onBusyChange(true);setError('');try{
  if(photo){await api(`/admin/gallery/${photo.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({caption,alt:photo.alt,category,sortOrder,published})});await onSaved();onCancel();}
  else{
   if(!items.length)throw new Error('Choose at least one photo.');
   const result=await uploadImages(items,category,published,body=>api('/admin/gallery',{method:'POST',body}),setItems);
   await onSaved();
   if(result.every(item=>item.status==='done'))onCancel();
   else setError('Some photos could not be uploaded. Review the errors below and retry the failed photos. Successfully uploaded photos will not be sent again.');
  }
 }catch(error){setError((error as Error).message);}finally{setBusy(false);onBusyChange(false);}}
 const done=items.filter(item=>item.status==='done').length;
 return <form onSubmit={submit} className="space-y-4">
 {!photo&&<><div className="space-y-2"><Label htmlFor="gallery-file">Photos</Label><Input id="gallery-file" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy} onChange={e=>{const files=[...e.target.files||[]];if(files.length>20){setError('Choose up to 20 photos at a time.');e.target.value='';setItems([]);return;}setItems(files.map(file=>({file,status:'pending'})));setError('');}}/><p className="text-xs text-muted-foreground">Select up to 20 photos, up to 10 MB each. Each filename becomes its alt text and initial caption.</p></div>
 {items.length>0&&<div className="space-y-2"><p className="text-sm" role="status" aria-live="polite">{done} of {items.length} uploaded</p><progress className="w-full accent-amber-500" value={done} max={items.length} aria-label="Photo upload progress"/><ul className="max-h-48 overflow-auto space-y-2 text-xs">{items.map((item,index)=><li key={index} className="rounded-md border p-2"><span className="font-medium break-all">{item.file.name}</span><span className="block text-muted-foreground">{item.status==='done'?'Uploaded':item.status==='uploading'?'Uploading…':item.status==='failed'?item.error:'Ready to upload'}</span></li>)}</ul></div>}</>}
 {photo&&<><div className="space-y-2"><Label htmlFor="photo-caption">Caption</Label><Input id="photo-caption" disabled={busy} required maxLength={200} value={caption} onChange={e=>setCaption(e.target.value)}/></div><div className="space-y-2"><Label htmlFor="photo-alt">Alternative text</Label><Input id="photo-alt" readOnly value={photo.alt}/><p className="text-xs text-muted-foreground">New uploads automatically use the original filename.</p></div></>}
 <div className="space-y-2"><Label htmlFor="photo-category">Category{!photo?' for selected photos':''}</Label><select id="photo-category" className="admin-select" disabled={busy} value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
 {photo&&<div className="space-y-2"><Label htmlFor="photo-order">Display order</Label><Input id="photo-order" disabled={busy} type="number" min={-100000} max={100000} value={sortOrder} onChange={e=>setSortOrder(Number(e.target.value))}/><p className="text-xs text-muted-foreground">Lower numbers appear first.</p></div>}
 <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy} checked={published} onChange={e=>setPublished(e.target.checked)}/>{photo?'Publish on the public gallery':'Publish selected photos after upload'}</label>
 <p role="alert" className="text-sm text-red-700">{error}</p><div className="flex justify-end gap-3"><Button variant="outline" type="button" disabled={busy} onClick={onCancel}>Cancel</Button><Button type="submit" disabled={busy||(!photo&&!items.some(item=>item.status!=='done'))}>{busy?'Uploading…':photo?'Save changes':done?'Retry failed photos':`Upload ${items.length||''} photos`}</Button></div>
 </form>;
}

function App(){
 const [email,setEmail]=useState(''),[photos,setPhotos]=useState<Photo[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{document.body.classList.toggle('admin-signed-in',Boolean(email));return()=>document.body.classList.remove('admin-signed-in');},[email]);
 const [view,setView]=useState<'gallery'|'users'>('gallery');
 const [uploadBusy,setUploadBusy]=useState(false);
 const [editor,setEditor]=useState<{photo:Photo|null}|null>(null),[query,setQuery]=useState('');
 async function refresh(){const data=await api('/admin/gallery');setPhotos(data.images);}
 async function login(){const identity=await api('/admin/me');await refresh();setEmail(identity.email);setError('');}
 useEffect(()=>{if(!auth||!apiBase){setLoading(false);return;}auth.getSession().then(async({data})=>{if(data?.user)await login();}).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
 async function signOut(){try{await auth?.signOut();}finally{setEmail('');setPhotos([]);setError('');}}
 async function toggle(photo:Photo){setError('');try{await api(`/admin/gallery/${photo.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...photo,published:!photo.published})});await refresh();}catch(error){setError((error as Error).message);}}
 if(loading)return <p className="p-10 text-center" role="status">Loading administration…</p>;
 if(!email)return <>{error&&<p className="admin-auth-notice" role="alert">{error}</p>}<AuthForm onLogin={login}/></>;
 const visible=photos.filter(p=>`${p.caption} ${p.category}`.toLowerCase().includes(query.toLowerCase()));
 return <SidebarProvider><Sidebar variant="inset"><SidebarHeader className="p-5"><a href="index.html" className="flex items-center gap-2 font-bold"><MapPin className="text-amber-400"/>Happy Cape Tours</a><p className="text-xs opacity-70">ADMINISTRATION</p></SidebarHeader><SidebarContent><SidebarGroup><SidebarMenu><SidebarMenuItem><SidebarMenuButton isActive={view==='gallery'} onClick={()=>setView('gallery')}><Images/><span>Gallery</span></SidebarMenuButton></SidebarMenuItem><SidebarMenuItem><SidebarMenuButton isActive={view==='users'} onClick={()=>setView('users')}><Eye/><span>Users &amp; saved tours</span></SidebarMenuButton></SidebarMenuItem><SidebarMenuItem><SidebarMenuButton asChild><a href="gallery.html" target="_blank" rel="noopener noreferrer"><ExternalLink/><span>View public gallery</span></a></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarGroup></SidebarContent><SidebarFooter className="p-4"><p className="text-xs break-all mb-2">{email}</p><SidebarMenuButton onClick={signOut}><LogOut/>Sign out</SidebarMenuButton></SidebarFooter></Sidebar>
 <SidebarInset><div className="admin-dashboard-header flex items-center gap-3 px-6 py-4 border-b"><SidebarTrigger/><span className="text-sm text-muted-foreground">Administration / {view==='gallery'?'Gallery':'Users & saved tours'}</span></div>{view==='users'?<UsersPanel/>:<div className="p-5 md:p-8 space-y-7"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-serif text-3xl font-bold">Your gallery</h2><p className="text-muted-foreground mt-2">Share the moments that make the Cape unforgettable.</p></div><Button onClick={()=>setEditor({photo:null})}><Upload/>Upload photos</Button></div>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{[['Uploaded photos',photos.length],['Published',photos.filter(p=>p.published).length],['Drafts',photos.filter(p=>!p.published).length]].map(([label,count])=><Card key={label}><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{label}</p><p className="text-3xl font-bold mt-2">{count}</p></CardContent></Card>)}</div>
 <div className="flex gap-3"><Input aria-label="Search gallery" placeholder="Search captions or categories…" value={query} onChange={e=>setQuery(e.target.value)}/><Button variant="outline" aria-label="Refresh gallery" onClick={()=>refresh().catch(e=>setError(e.message))}><RefreshCw/></Button></div>
 <p className="text-sm text-red-700" role="alert">{error}</p>
 {visible.length===0?<Card><CardContent className="text-center py-16"><Images className="mx-auto mb-4 text-muted-foreground"/><h3 className="font-semibold">{photos.length?'No matching photos':'Ready for your first photo?'}</h3><p className="text-muted-foreground mt-2">{photos.length?'Try a different search.':'Upload photos and publish them when they are ready. Only your published uploads appear in the public gallery.'}</p></CardContent></Card>:<div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">{visible.map(photo=><Card key={photo.id} className="overflow-hidden"><img src={photo.preview} alt={photo.alt} className="aspect-[4/3] w-full object-cover" width={photo.width} height={photo.height} loading="lazy"/><CardContent className="p-5 space-y-3"><div className="flex justify-between gap-2"><Badge variant={photo.published?'default':'secondary'}>{photo.published?'Published':'Draft'}</Badge><span className="text-xs text-muted-foreground">{photo.category} · Order {photo.sortOrder}</span></div><h3 className="font-semibold">{photo.caption}</h3><div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>setEditor({photo})}><Pencil/>Edit</Button><Button variant="ghost" size="sm" onClick={()=>toggle(photo)}>{photo.published?<EyeOff/>:<Eye/>}{photo.published?'Hide':'Publish'}</Button></div></CardContent></Card>)}</div>}
 </div>}</SidebarInset><Dialog open={Boolean(editor)} onOpenChange={open=>{if(!open&&!uploadBusy)setEditor(null);}}><DialogContent onEscapeKeyDown={event=>{if(uploadBusy)event.preventDefault();}} onInteractOutside={event=>{if(uploadBusy)event.preventDefault();}} className={`max-h-[90dvh] overflow-y-auto ${uploadBusy?'[&>button]:pointer-events-none [&>button]:opacity-40':''}`}><DialogHeader><DialogTitle>{editor?.photo?'Edit photo':'Upload gallery photos'}</DialogTitle><DialogDescription>{editor?.photo?'Update the caption, category and publishing options.':'Select multiple photos. Filenames are automatically used as alt text.'}</DialogDescription></DialogHeader>{editor&&<PhotoForm key={editor.photo?.id||'new'} photo={editor.photo} onSaved={refresh} onCancel={()=>setEditor(null)} onBusyChange={setUploadBusy}/>}</DialogContent></Dialog></SidebarProvider>;
}
const root=document.getElementById('admin-root');if(root)createRoot(root).render(<App/>);
