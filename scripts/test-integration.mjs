// Real service integration test. It creates and removes only its own fixtures on a non-production branch.
import dotenv from 'dotenv';import pg from 'pg';import sharp from 'sharp';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {S3Client,DeleteObjectCommand} from '@aws-sdk/client-s3';
dotenv.config({path:'.env.local',quiet:true});dotenv.config({path:'.env',quiet:true});
if(!process.env.NEON_BRANCH || process.env.NEON_BRANCH==='production')throw new Error('Integration fixtures may only run on the isolated development branch.');
const api=process.env.NEON_FUNCTION_GALLERY_BASE_URL?.replace(/\/$/,'');const auth=process.env.NEON_AUTH_BASE_URL?.replace(/\/$/,'');
if(!api||!auth)throw new Error('Deploy the Neon gallery and Auth services first.');
const client=new pg.Client({connectionString:process.env.DATABASE_URL_UNPOOLED});const storage=new S3Client({forcePathStyle:true});
const email=`hct-e2e-${randomUUID()}@example.invalid`;const password=randomUUID()+randomUUID();let userId;let imageId;let objectKey;
async function authRequest(path,body,cookie){const headers={'Content-Type':'application/json',Origin:'http://localhost:3000',...(cookie?{Cookie:cookie}:{})};const response=await fetch(auth+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw new Error(`Neon Auth ${path}: HTTP ${response.status}`);return {response,data,cookie:response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')};}
async function request(path,options={}){return fetch(api+path,options);}
try{
 await client.connect();assert.equal((await client.query('SELECT 1 AS connected')).rows[0].connected,1);console.log('PASS Postgres connection');
 const health=await request('/health');assert.equal(health.status,200);console.log('PASS deployed Neon Function');
 const signup=await authRequest('/sign-up/email',{email,password,name:'Disposable gallery integration fixture'});
 userId=signup.data.user?.id || (await client.query('SELECT id FROM neon_auth."user" WHERE email=$1',[email])).rows[0]?.id;
 assert.ok(userId);
 // Verification is changed only for this disposable identity. Real admins use the emailed code.
 await client.query('UPDATE neon_auth."user" SET "emailVerified"=true WHERE id=$1 AND email=$2',[userId,email]);
 const signed=await authRequest('/sign-in/email',{email,password});const cookie=signed.cookie;assert.ok(cookie);
 const session=await authRequest('/get-session',null,cookie);assert.equal(session.data.user.id,userId);console.log('PASS Neon Auth signup, signin and session restoration');
 const tokenResult=await authRequest('/token',null,cookie);assert.ok(tokenResult.data.token);const headers={Authorization:`Bearer ${tokenResult.data.token}`};
 assert.equal((await request('/admin/me')).status,401);assert.equal((await request('/admin/me',{headers})).status,403);console.log('PASS anonymous and non-admin denial');
 await client.query('INSERT INTO gallery_admins (email) VALUES ($1)',[email]);
 await client.query('UPDATE neon_auth."user" SET "emailVerified"=false WHERE id=$1',[userId]);assert.equal((await request('/admin/me',{headers})).status,403);
 await client.query('UPDATE neon_auth."user" SET "emailVerified"=true WHERE id=$1',[userId]);assert.equal((await request('/admin/me',{headers})).status,200);console.log('PASS verified-email administrator authorization');
 const image=await sharp({create:{width:64,height:48,channels:3,background:'#fbbf24'}}).jpeg().toBuffer();
 const form=new FormData();form.set('image',new Blob([image],{type:'image/jpeg'}),'test.jpg');form.set('caption','Disposable integration photo');form.set('alt','Gold test image');form.set('category','landscape');
 const uploaded=await request('/admin/gallery',{method:'POST',headers,body:form});assert.equal(uploaded.status,201);const record=(await uploaded.json()).image;imageId=record.id;
 objectKey=(await client.query('SELECT object_key FROM gallery_images WHERE id=$1',[imageId])).rows[0].object_key;
 assert.equal(record.published,false);assert.equal((await request(`/media/${imageId}`)).status,404);console.log('PASS private draft upload, image processing, storage and Postgres metadata');
 const update={caption:'Disposable integration photo',alt:'Gold test image',category:'landscape',sortOrder:-10,published:true};
 assert.equal((await request(`/admin/gallery/${imageId}`,{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(update)})).status,200);
 const gallery=await(await request('/gallery')).json();assert.ok(gallery.images.some(photo=>photo.id===imageId));
 const media=await request(`/media/${imageId}`);assert.equal(media.status,200);assert.match(media.headers.get('content-type'),/image\/webp/);const metadata=await sharp(Buffer.from(await media.arrayBuffer())).metadata();assert.equal(metadata.width,64);console.log('PASS publish → public gallery → object download');
 update.published=false;assert.equal((await request(`/admin/gallery/${imageId}`,{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(update)})).status,200);
 assert.equal((await request(`/media/${imageId}`)).status,404);console.log('PASS unpublish removes public access');
 await authRequest('/sign-out',{},cookie);const ended=await authRequest('/get-session',null,cookie);assert.ok(!ended.data?.user);console.log('PASS Neon Auth signout');
 console.log('All real Neon service integration checks passed.');
}finally{
 if(objectKey)await storage.send(new DeleteObjectCommand({Bucket:'assets',Key:objectKey}));
 if(imageId)await client.query('DELETE FROM gallery_images WHERE id=$1 AND created_by=$2',[imageId,userId]);
 await client.query('DELETE FROM gallery_admins WHERE email=$1',[email]).catch(()=>{});
 if(userId)await client.query('DELETE FROM neon_auth."user" WHERE id=$1 AND email=$2',[userId,email]);
 await client.end();
 console.log('Removed disposable integration fixtures.');
}
