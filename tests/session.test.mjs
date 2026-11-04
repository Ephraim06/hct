import {test} from 'node:test';import assert from 'node:assert/strict';
import {createAuthClient} from '@neondatabase/auth';
import {getAccessToken} from '../dist/session.mjs';
test('The installed Neon SDK provides its cached bearer JWT through getSession, not token()',async()=>{
 const originalFetch=globalThis.fetch;
 const token=Buffer.from('{"alg":"EdDSA"}').toString('base64url')+'.'+Buffer.from('{"sub":"test-user"}').toString('base64url')+'.test-signature';
 globalThis.fetch=async()=>Response.json({session:{id:'session',token:'opaque-cookie-token',userId:'test-user',expiresAt:new Date(Date.now()+3600000).toISOString(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},user:{id:'test-user',email:'test@example.invalid',name:'Test',emailVerified:true,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}},{headers:{'set-auth-jwt':token}});
 try{
  const client=createAuthClient('https://auth.example/neondb/auth');
  const session=await client.getSession();assert.equal(session.data.session.token,token);
  const legacy=await client.token();assert.equal(legacy.data.token,undefined);
  assert.equal(await getAccessToken(client),token);
 }finally{globalThis.fetch=originalFetch;}
});
test('Missing, opaque and failed sessions are never sent as bearer tokens',async()=>{
 for(const result of [{data:null,error:null},{data:{session:{token:'opaque-cookie'}},error:null},{data:{session:{token:'a.b.c'}},error:{message:'Expired'}}])assert.equal(await getAccessToken({getSession:async()=>result}),null);
});
