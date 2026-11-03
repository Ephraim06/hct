import assert from 'node:assert/strict';
const origins=['https://www.happycapetours.com','https://happycapetours.com'];
let ready=false;
for(let attempt=1;attempt<=18;attempt++){
 try{
  for(const origin of origins){
   const response=await fetch(origin+'/admin.html?signup-check=076d19d',{signal:AbortSignal.timeout(15000)});
   assert.equal(response.status,200);assert.match(await response.text(),/id="admin-root"/);
  }
  ready=true;break;
 }catch{console.log(`Waiting for GitHub Pages publication (${attempt}/18)…`);await new Promise(resolve=>setTimeout(resolve,10000));}
}
assert.ok(ready,'The admin page has not finished publishing.');
for(const origin of origins){
 const config=await fetch(origin+'/assets/backend-config.js',{signal:AbortSignal.timeout(15000)});assert.equal(config.status,200);assert.match(await config.text(),/br-divine-forest-bdtq10cq-gallery/);
 const bundle=await fetch(origin+'/assets/admin.bundle.js',{signal:AbortSignal.timeout(15000)});assert.equal(bundle.status,200);assert.ok((await bundle.text()).length>100000);
 console.log(`PASS ${origin}/admin.html: live page, login bundle and production Neon configuration`);
}
