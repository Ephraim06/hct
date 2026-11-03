import dotenv from 'dotenv';import assert from 'node:assert/strict';
dotenv.config({path:'.env.local',quiet:true});
const auth=process.env.NEON_AUTH_BASE_URL.replace(/\/$/,'');
const api=process.env.NEON_FUNCTION_GALLERY_BASE_URL.replace(/\/$/,'');
for(const origin of ['http://localhost:3000','http://localhost:5500','http://127.0.0.1:5173','https://www.happycapetours.com','https://happycapetours.com']){
 const response=await fetch(auth+'/sign-up/email',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'invalid',password:'x',name:''}),signal:AbortSignal.timeout(20000)});
 const data=await response.json();
 // Invalid inputs must reach validation, without creating accounts or sending email.
 assert.equal(response.status,400,`${origin}: signup HTTP ${response.status}, ${data.code}`);
 assert.ok(!/origin|domain/i.test(data.code || ''),`${origin}: signup origin rejected`);
 console.log(`PASS signup validation accepts origin ${origin} (no account created)`);
 const cors=await fetch(api+'/admin/me',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'GET'},signal:AbortSignal.timeout(20000)});
 assert.equal(cors.headers.get('access-control-allow-origin'),origin,`${origin}: gallery API CORS`);
 console.log(`PASS gallery API allows ${origin}`);
}
for(const url of ['https://www.happycapetours.com/admin.html','https://happycapetours.com/admin.html']){
 const response=await fetch(url,{signal:AbortSignal.timeout(20000)});const text=await response.text();
 console.log(`Website ${url}: HTTP ${response.status}, admin UI ${text.includes('id="admin-root"')?'present':'not published'}`);
}
