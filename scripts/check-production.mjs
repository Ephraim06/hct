import dotenv from 'dotenv';import pg from 'pg';import assert from 'node:assert/strict';import sharp from 'sharp';import {S3Client,HeadBucketCommand} from '@aws-sdk/client-s3';
dotenv.config({path:'.env.local',quiet:true});dotenv.config({path:'.env',quiet:true});
assert.equal(process.env.NEON_BRANCH,'production','Check out production first.');
const client=new pg.Client({connectionString:process.env.DATABASE_URL_UNPOOLED,connectionTimeoutMillis:15000});
try{
 await client.connect();
 const grant=await client.query('SELECT email FROM gallery_admins WHERE email=$1',['info@happycapetours.com']);assert.equal(grant.rowCount,1);
 await client.query('SELECT id FROM gallery_images LIMIT 1');console.log('PASS production Postgres schema and administrator grant');
 const storage=new S3Client({forcePathStyle:true});await storage.send(new HeadBucketCommand({Bucket:'assets'}));console.log('PASS production private image bucket');
 const base=process.env.NEON_FUNCTION_GALLERY_BASE_URL.replace(/\/$/,'');
 let ready=false;for(let attempt=0;attempt<60;attempt++){const response=await fetch(base+'/health?revision=traveller-saves-1&attempt='+attempt,{signal:AbortSignal.timeout(20000)});if(response.ok&&(await response.json()).version==='traveller-saves-1'){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,2000));}assert.ok(ready,'Production gallery revision is not ready.');
 for(const [path,status]of [['/health',200],['/gallery',200],['/admin/me',401]]){const response=await fetch(base+path);assert.equal(response.status,status,path);if(path==='/gallery'){
    const {images}=await response.json();assert.ok(Array.isArray(images));
    for(const image of images.slice(0,5)){
      const media=await fetch(base+image.src,{signal:AbortSignal.timeout(20000)});assert.equal(media.status,200);assert.equal(media.headers.get('cross-origin-resource-policy'),'cross-origin');assert.match(media.headers.get('content-type'),/^image\/webp/);
      const metadata=await sharp(Buffer.from(await media.arrayBuffer())).metadata();assert.equal(metadata.format,'webp');assert.ok(metadata.width>0);
    }
    console.log(`PASS ${Math.min(images.length,5)} actual published photo downloads and browser embedding headers`);
  }console.log(`PASS production ${path} HTTP ${response.status}`);}
 const configuration=await(await fetch(base+'/config')).json();assert.equal(configuration.authUrl,process.env.NEON_AUTH_BASE_URL);
 const preflight=await fetch(base+'/admin/gallery',{method:'OPTIONS',headers:{Origin:'https://www.happycapetours.com','Access-Control-Request-Method':'POST'}});assert.equal(preflight.headers.get('access-control-allow-origin'),'https://www.happycapetours.com');
 console.log('PASS production Auth URL and website CORS');
 console.log('All production smoke checks passed.');
}finally{await client.end();}
