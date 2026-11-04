import {StyledNumber} from './ui/styled-number';
import {StyledCheckbox} from './ui/styled-checkbox';
import {StyledSelect} from './ui/styled-select';
import React,{useState,useRef} from 'react';
import {api}from'../lib/auth';
import {uploadImages,type UploadItem}from'../lib/gallery-uploads';
import{Button}from'./ui/button';import{Input}from'./ui/input';import{Label}from'./ui/label';
export type Photo={id:string;src:string;preview:string;caption:string;alt:string;category:string;sortOrder:number;published:boolean;width:number;height:number;purpose?:'gallery'|'hero'};
const categories=[['landscape','Landscape'],['wildlife','Wildlife'],['people','People'],['culture','Culture']];
export function PhotoForm({photo,onSaved,onCancel,onBusyChange}:{photo:Photo|null;onSaved:()=>Promise<void>;onCancel:()=>void;onBusyChange:(busy:boolean)=>void}){
 const fileInput=useRef<HTMLInputElement>(null);
 const [caption,setCaption]=useState(photo?.caption||''),[category,setCategory]=useState(photo?.category||'landscape');
 const [sortOrder,setSortOrder]=useState(photo?.sortOrder||0),[published,setPublished]=useState(photo?.published||false),[items,setItems]=useState<UploadItem[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);onBusyChange(true);setError('');try{
  if(photo){await api(`/admin/gallery/${photo.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({caption,alt:photo.alt,category,sortOrder,published:photo.purpose==='hero'?false:published})});await onSaved();onCancel();}
  else{
   if(!items.length)throw new Error('Choose at least one photo.');
   const result=await uploadImages(items,category,published,body=>api('/admin/gallery',{method:'POST',body}),setItems);
   await onSaved();
   if(result.every(item=>item.status==='done'))onCancel();
   else setError('Some photos could not be uploaded. Review the errors below and retry the failed photos. Successfully uploaded photos will not be sent again.');
  }
 }catch(error){setError((error as Error).message);}finally{setBusy(false);onBusyChange(false);}}
 const done=items.filter(item=>item.status==='done').length;
 return <form noValidate onSubmit={submit} className="space-y-4">
 {!photo&&<><div className="space-y-2"><Label htmlFor="gallery-file">Photos</Label><div className="hct-file-drop"><Button type="button" variant="outline" disabled={busy} onClick={()=>fileInput.current?.click()}>＋ Choose photos</Button><Input ref={fileInput} hidden className="hidden" id="gallery-file" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy} onChange={e=>{const files=[...e.target.files||[]];if(files.length>20){setError('Choose up to 20 photos at a time.');e.target.value='';setItems([]);return;}setItems(files.map(file=>({file,status:'pending'})));setError('');}}/></div><p className="text-xs text-muted-foreground">Select up to 20 photos, up to 10 MB each. Each filename becomes its alt text and initial caption.</p></div>
 {items.length>0&&<div className="space-y-2"><p className="text-sm" role="status" aria-live="polite">{done} of {items.length} uploaded</p><div className="hct-upload-progress" role="progressbar" aria-label="Photo upload progress" aria-valuenow={done} aria-valuemin={0} aria-valuemax={items.length}><span style={{width:`${done/items.length*100}%`}}/></div><ul className="max-h-48 overflow-auto space-y-2 text-xs">{items.map((item,index)=><li key={index} className="rounded-md border p-2"><span className="font-medium break-all">{item.file.name}</span><span className="block text-muted-foreground">{item.status==='done'?'Uploaded':item.status==='uploading'?'Uploading…':item.status==='failed'?item.error:'Ready to upload'}</span></li>)}</ul></div>}</>}
 {photo&&<><div className="space-y-2"><Label htmlFor="photo-caption">Caption</Label><Input id="photo-caption" disabled={busy} required maxLength={200} value={caption} onChange={e=>setCaption(e.target.value)}/></div><div className="space-y-2"><Label htmlFor="photo-alt">Alternative text</Label><Input id="photo-alt" readOnly value={photo.alt}/><p className="text-xs text-muted-foreground">New uploads automatically use the original filename.</p></div></>}
 <div className="space-y-2"><Label htmlFor="photo-category">Category{!photo?' for selected photos':''}</Label><StyledSelect id="photo-category" className="admin-select" disabled={busy} value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(([value,label])=><option key={value} value={value}>{label}</option>)}</StyledSelect></div>
 {photo&&<div className="space-y-2"><Label htmlFor="photo-order">Display order</Label><StyledNumber id="photo-order" disabled={busy} min={-100000} max={100000} value={sortOrder} onChange={e=>setSortOrder(Number(e.target.value))}/><p className="text-xs text-muted-foreground">Lower numbers appear first.</p></div>}
 {photo?.purpose!=='hero'&&<label className="flex items-center gap-2 text-sm"><StyledCheckbox disabled={busy} checked={published} onChange={e=>setPublished(e.target.checked)}/>{photo?'Publish on the public gallery':'Publish selected photos after upload'}</label>}
 <p role="alert" className="text-sm text-red-700">{error}</p><div className="flex justify-end gap-3"><Button variant="outline" type="button" disabled={busy} onClick={onCancel}>Cancel</Button><Button type="submit" disabled={busy||(!photo&&!items.some(item=>item.status!=='done'))}>{busy?'Uploading…':photo?'Save changes':done?'Retry failed photos':`Upload ${items.length||''} photos`}</Button></div>
 </form>;
}

