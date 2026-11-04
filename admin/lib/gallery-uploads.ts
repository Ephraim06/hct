export type UploadItem = {file:File;status:'pending'|'uploading'|'done'|'failed';error?:string};
const formats=new Set(['image/jpeg','image/png','image/webp','image/avif']);
export async function uploadImages(items:UploadItem[],category:string,published:boolean,send:(body:FormData)=>Promise<unknown>,onChange:(items:UploadItem[])=>void):Promise<UploadItem[]> {
 if(items.length>20)throw new Error('Choose up to 20 photos at a time.');
 const results=items.map(item=>({...item}));
 const emit=()=>onChange(results.map(item=>({...item})));
 for(const item of results){
  if(item.status==='done')continue;
  item.status='uploading';item.error=undefined;emit();
  try{
   if(!formats.has(item.file.type)||!item.file.size||item.file.size>10*1024*1024)throw new Error('Use a JPEG, PNG, WebP or AVIF image under 10 MB.');
   if(item.file.name.length>300)throw new Error('Shorten the filename to 300 characters or fewer.');
   const body=new FormData();body.set('image',item.file);body.set('caption',item.file.name.slice(0,200));body.set('alt',item.file.name);body.set('category',category);body.set('published',String(published));
   await send(body);item.status='done';
  }catch(error){item.status='failed';item.error=error instanceof Error?error.message:'Upload failed. Please retry.';}
  emit();
 }
 return results;
}
