import dotenv from 'dotenv';import assert from 'node:assert/strict';import pg from 'pg';import {randomUUID} from 'node:crypto';
dotenv.config({path:'.env.local',quiet:true});
const auth=process.env.NEON_AUTH_BASE_URL.replace(/\/$/,'');
const api=process.env.NEON_FUNCTION_GALLERY_BASE_URL.replace(/\/$/,'');
const client=new pg.Client({connectionString:process.env.DATABASE_URL_UNPOOLED,connectionTimeoutMillis:15000});
await client.connect();
try{
 for(const origin of ['http://localhost:3000','http://localhost:5500','http://127.0.0.1:3000','http://127.0.0.1:5500','http://127.0.0.1:5173','https://www.happycapetours.com','https://happycapetours.com']){
  const email=`hct-origin-${randomUUID()}@example.invalid`;
  try{
   // Valid input is essential: malformed requests can fail validation before origin checks.
   // Synthetic identities receive no administrator grant and are removed immediately.
   const response=await fetch(auth+'/sign-up/email',{method:'POST',headers:{Origin:origin,Referer:origin+'/admin.html','Content-Type':'application/json','Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'cors'},body:JSON.stringify({email,password:randomUUID()+randomUUID(),name:'Disposable origin verification'}),signal:AbortSignal.timeout(20000)});
   const data=await response.json();
   assert.equal(response.status,200,`${origin}: signup HTTP ${response.status}, ${data.code}`);
   assert.ok(data.user?.id,`${origin}: signup returned no user`);
   console.log(`PASS real signup from ${origin}`);
   const cors=await fetch(api+'/admin/me',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'GET'},signal:AbortSignal.timeout(20000)});
   assert.equal(cors.headers.get('access-control-allow-origin'),origin,`${origin}: gallery API CORS`);
  }finally{
   await client.query('DELETE FROM neon_auth."user" WHERE email=$1',[email]);
  }
 }
 console.log('All signup origins passed; disposable identities removed.');
}finally{await client.end();}
