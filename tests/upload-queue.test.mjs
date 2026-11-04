import {test} from 'node:test';import assert from 'node:assert/strict';import {uploadImages} from '../dist/gallery-uploads.mjs';
const photo=(name,type='image/jpeg')=>new File(['image bytes'],name,{type});
test('Batch uploads use exact filenames for alt text and retry only failed items',async()=>{
 const items=[{file:photo('Cape Point.jpg'),status:'pending'},{file:photo('Penguins.png','image/png'),status:'pending'}];
 const calls=[];let fail=true;
 const send=async body=>{const file=body.get('image');calls.push(file.name);assert.equal(body.get('alt'),file.name);assert.equal(body.get('caption'),file.name);assert.equal(body.get('published'),'true');if(file.name==='Penguins.png'&&fail)throw new Error('Network error');};
 const updates=[];const result=await uploadImages(items,'wildlife',true,send,items=>updates.push(items));
 assert.deepEqual(result.map(item=>item.status),['done','failed']);assert.ok(updates.some(items=>items[0].status==='uploading'));fail=false;
 const retried=await uploadImages(result,'wildlife',true,send,()=>{});assert.deepEqual(retried.map(item=>item.status),['done','done']);assert.deepEqual(calls,['Cape Point.jpg','Penguins.png','Penguins.png']);
});
test('Invalid files are reported individually while other files continue',async()=>{
 const items=[{file:photo('unsafe.svg','image/svg+xml'),status:'pending'},{file:photo('Coast.jpg'),status:'pending'}];let requests=0;
 const result=await uploadImages(items,'landscape',false,async body=>{requests++;assert.equal(body.get('published'),'false');},()=>{});
 assert.deepEqual(result.map(item=>item.status),['failed','done']);assert.equal(requests,1);
});
test('Batches over twenty photos are rejected before any request',async()=>{
 await assert.rejects(uploadImages(Array.from({length:21},()=>({file:photo('Photo.jpg'),status:'pending'})),'landscape',false,async()=>{throw new Error('Should not be sent');},()=>{}),/up to 20/);
});
