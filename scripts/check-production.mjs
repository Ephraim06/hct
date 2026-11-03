import dotenv from 'dotenv';import pg from 'pg';import assert from 'node:assert/strict';import {S3Client,HeadBucketCommand} from '@aws-sdk/client-s3';
dotenv.config({path:'.env.local',quiet:true});dotenv.config({path:'.env',quiet:true});
assert.equal(process.env.NEON_BRANCH,'production','Check out production first.');
const client=new pg.Client({connectionString:process.env.DATABASE_URL_UNPOOLED,connectionTimeoutMillis:15000});
try{
 await client.connect();
 const grant=await client.query('SELECT email FROM gallery_admins WHERE email=$1',['info@happycapetours.com']);assert.equal(grant.rowCount,1);
 await client.query('SELECT id FROM gallery_images LIMIT 1');console.log('PASS production Postgres schema and administrator grant');
 const storage=new S3Client({forcePathStyle:true});await storage.send(new HeadBucketCommand({Bucket:'assets'}));console.log('PASS production private image bucket');
 const base=process.env.NEON_FUNCTION_GALLERY_BASE_URL.replace(/\/$/,'');
 for(const [path,status]of [['/health',200],['/gallery',200],['/admin/me',401]]){const response=await fetch(base+path);assert.equal(response.status,status,path);if(path==='/gallery')assert.ok(Array.isArray((await response.json()).images));console.log(`PASS production ${path} HTTP ${response.status}`);}
 const configuration=await(await fetch(base+'/config')).json();assert.equal(configuration.authUrl,process.env.NEON_AUTH_BASE_URL);
 const preflight=await fetch(base+'/admin/gallery',{method:'OPTIONS',headers:{Origin:'https://www.happycapetours.com','Access-Control-Request-Method':'POST'}});assert.equal(preflight.headers.get('access-control-allow-origin'),'https://www.happycapetours.com');
 console.log('PASS production Auth URL and website CORS');
 console.log('All production smoke checks passed.');
}finally{await client.end();}
