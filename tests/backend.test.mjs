import {test} from 'node:test';
import assert from 'node:assert/strict';
import api from '../dist/api.mjs';
import {Hono} from 'hono';

test('Gallery API rejects unauthenticated writes before parsing the upload or accessing storage',async()=>{
 for(const [method,path]of [['GET','/admin/me'],['GET','/admin/gallery'],['POST','/admin/gallery'],['PATCH','/admin/gallery/00000000-0000-0000-0000-000000000000']]){
  const response=await api.request(path,{method,body:method==='GET'?undefined:'invalid body'});
  assert.equal(response.status,401,`${method} ${path}`);
 }
});
test('Gallery API rejects malformed identities and image IDs',async()=>{
 const response=await api.request('/admin/me',{headers:{Authorization:'Bearer invalid'}});assert.equal(response.status,401);
 assert.equal((await api.request('/media/not-an-id')).status,404);
});
test('CORS allows only the configured site origins and localhost',async()=>{
 for(const [origin,allowed]of [['https://www.happycapetours.com',true],['http://localhost:3000',true],['http://localhost:5500',true],['http://127.0.0.1:5173',true],['http://[::1]:8080',true],['https://happycapetours.com',true],['http://localhost.evil.example:5500',false],['https://www.happycapetours.com.evil.example',false],['https://untrusted.example',false]]){
  const response=await api.request('/admin/gallery',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST'}});
  assert.equal(response.headers.get('access-control-allow-origin'),allowed?origin:null);
 }
});
test('Public health and configuration responses contain no credentials',async()=>{
 const response=await api.request('/health');assert.equal(response.status,200);assert.equal((await response.json()).ok,true);
 const config=await(await api.request('/config')).json();assert.deepEqual(Object.keys(config),['authUrl']);
});

test('Published media routes allow cross-origin embedding while admin responses remain restricted',async()=>{
 const media=await api.request('/media/not-an-id');assert.equal(media.headers.get('cross-origin-resource-policy'),'cross-origin');
 const local=new Hono().route('/api',api);
 assert.equal((await local.request('/api/media/not-an-id')).headers.get('cross-origin-resource-policy'),'cross-origin');
 const admin=await api.request('/admin/me');assert.equal(admin.headers.get('cross-origin-resource-policy'),'same-origin');
 assert.equal(admin.status,401);
});

test('Traveller collections and administrator user lists require authentication',async()=>{
 for(const [path,method] of [['/account/me','GET'],['/account/saved-tours','GET'],['/account/saved-tours/cape-agulhas','POST'],['/account/saved-tours/cape-agulhas','DELETE'],['/admin/users','GET']])assert.equal((await api.request(path,{method})).status,401);
});
