import assert from 'node:assert/strict';
const base=process.env.TEST_APP_URL || 'http://127.0.0.1:3000';
for(const [path,status]of [['/api/health',200],['/admin',200],['/.env.local',404],['/.git/config',404],['/backend/index.ts',404],['/api/admin/me',401],['/assets/backend-config.js',200]]){
 const response=await fetch(base+path);assert.equal(response.status,status,path);console.log(`${response.status} ${path}`);
}
const denied=await fetch(base+'/api/admin/gallery',{method:'POST',body:'not-an-image'});assert.equal(denied.status,401);console.log('401 unauthenticated upload');
console.log('Local server, admin page, private-file protection and authorization checks passed.');
