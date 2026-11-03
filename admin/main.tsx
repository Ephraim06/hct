import React, {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createAuthClient} from '@neondatabase/auth';
import {Images, Upload, LogOut, ExternalLink, RefreshCw, Eye, EyeOff, Pencil, MapPin} from 'lucide-react';
import {Button} from './components/ui/button';
import {Input} from './components/ui/input';
import {Label} from './components/ui/label';
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from './components/ui/card';
import {Badge} from './components/ui/badge';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './components/ui/dialog';
import {Sidebar,SidebarProvider,SidebarContent,SidebarFooter,SidebarHeader,SidebarInset,SidebarTrigger,SidebarMenu,SidebarMenuItem,SidebarMenuButton,SidebarGroup} from './components/ui/sidebar';

declare global {interface Window {HCT_BACKEND?:{apiBaseUrl:string;authUrl:string}}}
const config=window.HCT_BACKEND;
const apiBase=config?.apiBaseUrl?.replace(/\/$/,'');
// These Managed Auth endpoints are documented by the SDK's endpoint map;
// its beta declaration loses plugin inference with patched Better Auth versions.
type AuthResult<T> = Promise<{data:T|null;error:{message?:string}|null}>;
type ManagedExtensions = {
 token:()=>AuthResult<{token:string}>;
 emailOtp:{sendVerificationOtp:(input:{email:string;type:'email-verification'})=>AuthResult<unknown>;verifyEmail:(input:{email:string;otp:string})=>AuthResult<unknown>};
};
const createManagedClient = (url:string) => createAuthClient(url);
const auth=config?.authUrl ? createManagedClient(config.authUrl) as ReturnType<typeof createManagedClient> & ManagedExtensions : null;
type Photo={id:string;src:string;preview:string;caption:string;alt:string;category:string;sortOrder:number;published:boolean;width:number;height:number};
const categories=[['landscape','Landscape'],['wildlife','Wildlife'],['people','People'],['culture','Culture']];
class ApiError extends Error {constructor(message:string,public status:number,public code?:string){super(message);}}
async function api(path:string, options:RequestInit={}){
 if(!auth||!apiBase)throw new Error('The gallery service has not been configured.');
 const {data,error}=await auth.token();if(error||!data?.token)throw new ApiError('Please sign in again.',401);
 const response=await fetch(apiBase+path,{...options,headers:{...options.headers,Authorization:`Bearer ${data.token}`}});
 const body=await response.json().catch(()=>({error:'The service returned an unexpected response.'}));
 if(!response.ok)throw new ApiError(body.error||'Request failed.',response.status,body.code);
 return body;
}
function AuthForm({onLogin}:{onLogin:()=>Promise<void>}){
 const [mode,setMode]=useState<'login'|'register'|'verify'|'recover'>('login');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[otp,setOtp]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function sendCode(){
  if(!auth)return;const result=await auth.emailOtp.sendVerificationOtp({email,type:'email-verification'});
  if(result.error)throw new Error(result.error.message||'The code could not be sent.');
  setMode('verify');setMessage('Check your inbox for your verification code.');
 }
 async function submit(event:React.FormEvent){
  event.preventDefault();setBusy(true);setMessage('');
  try{
   if(!auth)throw new Error('The sign-in service is not configured yet.');
   if(mode==='register'){
    const result=await auth.signUp.email({email,password,name:'Happy Cape Tours administrator'});
    if(result.error)throw new Error(result.error.message||'Your account could not be created.');
    await sendCode();
   }else if(mode==='verify'){
    const result=await auth.emailOtp.verifyEmail({email,otp});
    if(result.error)throw new Error(result.error.message||'The verification code is invalid or expired.');
    const signed=await auth.signIn.email({email,password});
    if(signed.error){setMode('login');setMessage('Email verified. Sign in with your password.');return;}
    await onLogin();
   }else if(mode==='recover'){
    const result=await auth.requestPasswordReset({email,redirectTo:new URL('admin.html',location.href).href});
    if(result.error)throw new Error(result.error.message||'Password recovery is unavailable.');
    setMessage('If an account exists, check your inbox for password recovery instructions.');
   }else{
    const result=await auth.signIn.email({email,password});
    if(result.error)throw new Error(result.error.message||'Please check your email and password.');
    await onLogin();
   }
  }catch(error){
   if(error instanceof ApiError && error.code==='EMAIL_UNVERIFIED'){
    setMode('verify');setMessage('Verify your email to continue. Use “Send a new code” below.');
   }else setMessage(error instanceof Error?error.message:'Something went wrong. Please try again.');
  }finally{setBusy(false);}
 }
 const [resetToken]=useState(new URLSearchParams(location.search).get('token'));
 const [resetDone,setResetDone]=useState(false);
 async function reset(event:React.FormEvent){event.preventDefault();setBusy(true);setMessage('');try{
  const result=await auth!.resetPassword({token:resetToken!,newPassword:password});
  if(result.error)throw new Error(result.error.message||'This reset link has expired.');
  setResetDone(true);history.replaceState(null,'','admin.html');setMessage('Password updated. You can now sign in.');setPassword('');
 }catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}
 const resetting=Boolean(resetToken&&!resetDone);
 return <div className="admin-login"><div className="admin-login-story"><span className="admin-eyebrow">HAPPY CAPE TOURS</span><h2>More adventures.<br/><em>Beautifully shared.</em></h2><p>Manage the photos that bring your Cape Town experiences to life.</p><a href="index.html">← Return to the website</a></div>
 <Card className="w-full max-w-md shadow-xl"><CardHeader><CardTitle className="text-2xl">{resetting?'Choose a new password':mode==='register'?'Create your admin account':mode==='verify'?'Verify your email':mode==='recover'?'Reset your password':'Welcome back'}</CardTitle><CardDescription>Happy Cape Tours administration. Access is restricted to approved administrators.</CardDescription></CardHeader><CardContent>
 <form onSubmit={resetting?reset:submit} className="space-y-5">
 {!resetting&&<div className="space-y-2"><Label htmlFor="admin-email">Email address</Label><Input id="admin-email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div>}
 {(resetting||mode==='login'||mode==='register')&&<div className="space-y-2"><Label htmlFor="admin-password">Password</Label><Input id="admin-password" type="password" autoComplete={mode==='register'||resetting?'new-password':'current-password'} minLength={mode==='register'||resetting?12:undefined} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/>{mode==='register'&&<p className="text-xs text-muted-foreground">Use at least 12 characters. Registration does not automatically grant admin access.</p>}</div>}
 {mode==='verify'&&!resetting&&<div className="space-y-2"><Label htmlFor="verification-code">Verification code</Label><Input id="verification-code" inputMode="numeric" autoComplete="one-time-code" required value={otp} onChange={e=>setOtp(e.target.value)} /></div>}
 <p className="text-sm text-muted-foreground" role="status" aria-live="polite">{message}</p>
 <Button className="w-full" type="submit" disabled={busy||!auth}>{busy?'Please wait…':resetting?'Save new password':mode==='register'?'Create account':mode==='verify'?'Verify email':mode==='recover'?'Send reset instructions':'Sign in'}</Button>
 </form>
 {!resetting&&<div className="flex flex-wrap gap-3 mt-5 text-sm">
 <Button variant="link" className="px-0" disabled={busy} onClick={()=>{setMode(mode==='login'?'register':'login');setMessage('');}}>{mode==='login'?'First time? Create an account':'Back to sign in'}</Button>
 {mode==='login'&&<Button variant="link" className="px-0" disabled={busy} onClick={()=>{setMode('recover');setMessage('');}}>Forgot password?</Button>}
 {mode==='verify'&&<Button variant="link" className="px-0" disabled={busy||!email} onClick={async()=>{setBusy(true);try{await sendCode();}catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}}>Send a new code</Button>}
 </div>}
 </CardContent></Card></div>;
}
function PhotoForm({photo,onSaved,onCancel}:{photo:Photo|null;onSaved:()=>Promise<void>;onCancel:()=>void}){
 const [caption,setCaption]=useState(photo?.caption||''),[alt,setAlt]=useState(photo?.alt||''),[category,setCategory]=useState(photo?.category||'landscape');
 const [sortOrder,setSortOrder]=useState(photo?.sortOrder||0),[published,setPublished]=useState(photo?.published||false),[file,setFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);setError('');try{
  if(photo)await api(`/admin/gallery/${photo.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({caption,alt,category,sortOrder,published})});
  else{
   if(!file||file.size>10*1024*1024)throw new Error('Choose a JPEG, PNG, WebP or AVIF image smaller than 10 MB.');
   const body=new FormData();body.set('image',file);body.set('caption',caption);body.set('alt',alt);body.set('category',category);
   await api('/admin/gallery',{method:'POST',body});
  }
  await onSaved();onCancel();
 }catch(error){setError((error as Error).message);}finally{setBusy(false);}}
 return <form onSubmit={submit} className="space-y-4">
 {!photo&&<div className="space-y-2"><Label htmlFor="gallery-file">Photo</Label><Input id="gallery-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required onChange={e=>setFile(e.target.files?.[0]||null)}/><p className="text-xs text-muted-foreground">Up to 10 MB. Photos are optimized automatically and uploaded as drafts.</p></div>}
 <div className="space-y-2"><Label htmlFor="photo-caption">Caption</Label><Input id="photo-caption" required maxLength={200} value={caption} onChange={e=>setCaption(e.target.value)}/></div>
 <div className="space-y-2"><Label htmlFor="photo-alt">Alternative text</Label><Input id="photo-alt" required maxLength={300} value={alt} onChange={e=>setAlt(e.target.value)}/><p className="text-xs text-muted-foreground">Describe what is in the photo for visitors using screen readers.</p></div>
 <div className="space-y-2"><Label htmlFor="photo-category">Category</Label><select id="photo-category" className="admin-select" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
 {photo&&<><div className="space-y-2"><Label htmlFor="photo-order">Display order</Label><Input id="photo-order" type="number" min={-100000} max={100000} value={sortOrder} onChange={e=>setSortOrder(Number(e.target.value))}/><p className="text-xs text-muted-foreground">Lower numbers appear first, ahead of the original gallery photos.</p></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)}/> Publish on the public gallery</label></>}
 <p role="alert" className="text-sm text-red-700">{error}</p><div className="flex justify-end gap-3"><Button variant="outline" type="button" disabled={busy} onClick={onCancel}>Cancel</Button><Button type="submit" disabled={busy}>{busy?'Saving…':photo?'Save changes':'Upload draft'}</Button></div>
 </form>;
}
function App(){
 const [email,setEmail]=useState(''),[photos,setPhotos]=useState<Photo[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{document.body.classList.toggle('admin-signed-in',Boolean(email));return()=>document.body.classList.remove('admin-signed-in');},[email]);
 const [editor,setEditor]=useState<{photo:Photo|null}|null>(null),[query,setQuery]=useState('');
 async function refresh(){const data=await api('/admin/gallery');setPhotos(data.images);}
 async function login(){const identity=await api('/admin/me');await refresh();setEmail(identity.email);setError('');}
 useEffect(()=>{if(!auth||!apiBase){setLoading(false);return;}auth.getSession().then(async({data})=>{if(data?.user)await login();}).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
 async function signOut(){try{await auth?.signOut();}finally{setEmail('');setPhotos([]);setError('');}}
 async function toggle(photo:Photo){setError('');try{await api(`/admin/gallery/${photo.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...photo,published:!photo.published})});await refresh();}catch(error){setError((error as Error).message);}}
 if(loading)return <p className="p-10 text-center" role="status">Loading administration…</p>;
 if(!email)return <>{error&&<p className="admin-auth-notice" role="alert">{error}</p>}<AuthForm onLogin={login}/></>;
 const visible=photos.filter(p=>`${p.caption} ${p.category}`.toLowerCase().includes(query.toLowerCase()));
 return <SidebarProvider><Sidebar variant="inset"><SidebarHeader className="p-5"><a href="index.html" className="flex items-center gap-2 font-bold"><MapPin className="text-amber-400"/>Happy Cape Tours</a><p className="text-xs opacity-70">ADMINISTRATION</p></SidebarHeader><SidebarContent><SidebarGroup><SidebarMenu><SidebarMenuItem><SidebarMenuButton isActive><Images/><span>Gallery</span></SidebarMenuButton></SidebarMenuItem><SidebarMenuItem><SidebarMenuButton asChild><a href="gallery.html" target="_blank" rel="noopener noreferrer"><ExternalLink/><span>View public gallery</span></a></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarGroup></SidebarContent><SidebarFooter className="p-4"><p className="text-xs break-all mb-2">{email}</p><SidebarMenuButton onClick={signOut}><LogOut/>Sign out</SidebarMenuButton></SidebarFooter></Sidebar>
 <SidebarInset><div className="admin-dashboard-header flex items-center gap-3 px-6 py-4 border-b"><SidebarTrigger/><span className="text-sm text-muted-foreground">Administration / Gallery</span></div><div className="p-5 md:p-8 space-y-7"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-serif text-3xl font-bold">Your gallery</h2><p className="text-muted-foreground mt-2">Share the moments that make the Cape unforgettable.</p></div><Button onClick={()=>setEditor({photo:null})}><Upload/>Upload photos</Button></div>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{[['Uploaded photos',photos.length],['Published',photos.filter(p=>p.published).length],['Drafts',photos.filter(p=>!p.published).length]].map(([label,count])=><Card key={label}><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{label}</p><p className="text-3xl font-bold mt-2">{count}</p></CardContent></Card>)}</div>
 <div className="flex gap-3"><Input aria-label="Search gallery" placeholder="Search captions or categories…" value={query} onChange={e=>setQuery(e.target.value)}/><Button variant="outline" aria-label="Refresh gallery" onClick={()=>refresh().catch(e=>setError(e.message))}><RefreshCw/></Button></div>
 <p className="text-sm text-red-700" role="alert">{error}</p>
 {visible.length===0?<Card><CardContent className="text-center py-16"><Images className="mx-auto mb-4 text-muted-foreground"/><h3 className="font-semibold">{photos.length?'No matching photos':'Ready for your first photo?'}</h3><p className="text-muted-foreground mt-2">{photos.length?'Try a different search.':'Upload a photo, add a caption, then publish when it is ready. Existing website photos remain in the public gallery.'}</p></CardContent></Card>:<div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">{visible.map(photo=><Card key={photo.id} className="overflow-hidden"><img src={photo.preview} alt={photo.alt} className="aspect-[4/3] w-full object-cover" width={photo.width} height={photo.height} loading="lazy"/><CardContent className="p-5 space-y-3"><div className="flex justify-between gap-2"><Badge variant={photo.published?'default':'secondary'}>{photo.published?'Published':'Draft'}</Badge><span className="text-xs text-muted-foreground">{photo.category} · Order {photo.sortOrder}</span></div><h3 className="font-semibold">{photo.caption}</h3><div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>setEditor({photo})}><Pencil/>Edit</Button><Button variant="ghost" size="sm" onClick={()=>toggle(photo)}>{photo.published?<EyeOff/>:<Eye/>}{photo.published?'Hide':'Publish'}</Button></div></CardContent></Card>)}</div>}
 </div></SidebarInset><Dialog open={Boolean(editor)} onOpenChange={open=>{if(!open)setEditor(null);}}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{editor?.photo?'Edit photo':'Upload a gallery photo'}</DialogTitle><DialogDescription>{editor?.photo?'Update the caption, category and publishing options.':'New photos start as private drafts. Publish them when you are ready.'}</DialogDescription></DialogHeader>{editor&&<PhotoForm key={editor.photo?.id||'new'} photo={editor.photo} onSaved={refresh} onCancel={()=>setEditor(null)}/>}</DialogContent></Dialog></SidebarProvider>;
}
const root=document.getElementById('admin-root');if(root)createRoot(root).render(<App/>);
