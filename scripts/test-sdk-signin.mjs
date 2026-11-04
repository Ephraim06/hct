// Exercise the same installed SDK and token helper as the browser, using a disposable account.
import dotenv from 'dotenv';import pg from 'pg';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {createAuthClient} from '@neondatabase/auth';import {getAccessToken} from '../dist/session.mjs';
dotenv.config({path:'.env.local',quiet:true});
const email=`hct-sdk-${randomUUID()}@example.invalid`,password=randomUUID()+randomUUID();
const db=new pg.Client({connectionString:process.env.DATABASE_URL_UNPOOLED,connectionTimeoutMillis:15000});
const nativeFetch=globalThis.fetch;const cookies=new Map();
const authUrl=process.env.NEON_AUTH_BASE_URL;
globalThis.fetch=async(input,init={})=>{
 const headers=new Headers(init.headers);headers.set('Origin','http://localhost:3000');
 if(cookies.size)headers.set('Cookie',[...cookies].map(([key,value])=>`${key}=${value}`).join('; '));
 const response=await nativeFetch(input,{...init,headers,signal:AbortSignal.timeout(20000)});
 for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';')[0];const split=pair.indexOf('=');cookies.set(pair.slice(0,split),pair.slice(split+1));}
 return response;
};
await db.connect();
try{
 const endpoint=process.env.NEON_FUNCTION_GALLERY_BASE_URL.replace(/\/$/,'');let ready=false;
 for(let i=0;i<90;i++){const response=await nativeFetch(endpoint+'/health?revision=enquiries-pwa-1&attempt='+i,{signal:AbortSignal.timeout(20000)});if(response.ok&&(await response.json()).version==='enquiries-pwa-1'){ready=true;break;}await new Promise(r=>setTimeout(r,2000));}
 assert.ok(ready,'Latest inbox/gallery deployment is not ready.');

 const client=createAuthClient(authUrl);
 const signedUp=await client.signUp.email({email,password,name:'Disposable SDK sign-in diagnostic'});assert.ok(!signedUp.error,'SDK signup failed');
 await db.query('UPDATE neon_auth."user" SET "emailVerified"=true WHERE email=$1',[email]);
 await db.query('INSERT INTO gallery_admins (email) VALUES ($1)',[email]);
 await client.signOut();
 const signedIn=await client.signIn.email({email,password,rememberMe:false});assert.ok(!signedIn.error,'SDK signin failed');
 const token=await getAccessToken(client);assert.ok(token,'The SDK provided no bearer JWT');
 const legacy=await client.token();assert.equal(legacy.data?.token,undefined,'The cached token response no longer matches the reproduced regression');
 const base=process.env.NEON_FUNCTION_GALLERY_BASE_URL.replace(/\/$/,'');
 for(const path of ['/admin/me','/admin/gallery','/admin/enquiries','/admin/enquiries/export']){const response=await nativeFetch(base+path,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});assert.equal(response.status,200,path);}
 console.log('PASS real SDK signup, sign-in, cached-session JWT and protected dashboard access');
 await client.signOut();console.log('PASS SDK signout');
}finally{
 globalThis.fetch=nativeFetch;
 await db.query('DELETE FROM gallery_admins WHERE email=$1',[email]);
 await db.query('DELETE FROM neon_auth."user" WHERE email=$1',[email]);
 await db.end();console.log('Removed disposable SDK test account.');
}
