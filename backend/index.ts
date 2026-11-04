import {Hono} from 'hono';
import {cors} from 'hono/cors';
import {bodyLimit} from 'hono/body-limit';
import {secureHeaders} from 'hono/secure-headers';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {and, eq, asc, desc} from 'drizzle-orm';
import {attachDatabasePool} from '@neon/functions';
import {S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {createRemoteJWKSet, jwtVerify} from 'jose';
import sharp, {type OutputInfo} from 'sharp';
import {randomUUID} from 'node:crypto';
import {galleryImages, adminInvitations} from './database/schema';
import {isAllowedOrigin} from './origins';

export const pool = new Pool({connectionString:process.env.DATABASE_URL, max:5, connectionTimeoutMillis:10000});
attachDatabasePool(pool);
const db=drizzle(pool);
const storage=new S3Client({forcePathStyle:true});
const bucket='assets';
const categories=new Set(['landscape','wildlife','people','culture']);
const jwks = process.env.NEON_AUTH_JWKS_URL ? createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL)) : null;
const issuer=process.env.NEON_AUTH_BASE_URL ? new URL(process.env.NEON_AUTH_BASE_URL).origin : '';
const app=new Hono<{Variables:{userId:string; email:string}}>();
// Published media is embedded by the separately hosted website. Admin responses remain same-origin.
app.use('*',(c,next)=>secureHeaders({crossOriginResourcePolicy:/^\/(?:api\/)?media\//.test(c.req.path)?'cross-origin':'same-origin'})(c,next));
app.use('*',cors({origin:origin=>isAllowedOrigin(origin)?origin:undefined, allowMethods:['GET','POST','PATCH','OPTIONS'],allowHeaders:['Authorization','Content-Type'],maxAge:600}));
app.onError((error,c)=>{console.error('Gallery request failed',error.name);return c.json({error:'The request could not be completed. Please try again.'},500);});
app.get('/health',c=>c.json({ok:true,service:'Happy Cape Tours gallery',version:'gallery-media-3'}));
app.get('/config',c=>c.json({authUrl:process.env.NEON_AUTH_BASE_URL || ''}));
app.use('/admin/*',async(c,next)=>{
  c.header('Cache-Control','no-store');
  const token=c.req.header('Authorization');
  if(!jwks || !token?.startsWith('Bearer '))return c.json({error:'Please sign in.'},401);
  let userId:string;
  try {
    const {payload}=await jwtVerify(token.slice(7),jwks,{issuer,algorithms:['EdDSA']});
    if(!payload.sub) return c.json({error:'Please sign in.'},401);
    userId=payload.sub;
  } catch{return c.json({error:'Your session has expired. Please sign in again.'},401);}
  // Use the current database identity and verification status, never an untrusted email claim.
  const identity=await pool.query('SELECT id, email, "emailVerified" FROM neon_auth."user" WHERE id=$1',[userId]);
  const user=identity.rows[0];
  if(!user || !user.emailVerified)return c.json({error:'Verify your email address before accessing administration.',code:'EMAIL_UNVERIFIED'},403);
  const [grant]=await db.select().from(adminInvitations).where(eq(adminInvitations.email,user.email.toLowerCase())).limit(1);
  if(!grant)return c.json({error:'This account has not been authorized as an administrator.'},403);
  c.set('userId',userId);c.set('email',user.email);await next();
});
app.get('/admin/me',c=>c.json({email:c.get('email'),userId:c.get('userId')}));
function fields(value:Record<string,unknown>){
  if(typeof value.caption!=='string'||value.caption.trim().length<1||value.caption.trim().length>200)throw new Error('Caption must be 1–200 characters.');
  if(typeof value.alt!=='string'||value.alt.trim().length<1||value.alt.trim().length>300)throw new Error('Alternative text must be 1–300 characters.');
  if(typeof value.category!=='string'||!categories.has(value.category))throw new Error('Choose a valid category.');
  return {caption:value.caption.trim(),alt:value.alt.trim(),category:value.category};
}
function publicImage(row:typeof galleryImages.$inferSelect){
  return {id:row.id,caption:row.caption,alt:row.alt,category:row.category,width:row.width,height:row.height,sortOrder:row.sortOrder,src:`/media/${row.id}`};
}
app.get('/gallery',async c=>{
  const images=await db.select().from(galleryImages).where(and(eq(galleryImages.published,true),eq(galleryImages.archived,false))).orderBy(asc(galleryImages.sortOrder),desc(galleryImages.createdAt)).limit(500);
  c.header('Cache-Control','no-store');return c.json({images:images.map(publicImage)});
});
app.get('/media/:id',async c=>{
  if(!/^[0-9a-f-]{36}$/i.test(c.req.param('id')))return c.notFound();
  const [image]=await db.select().from(galleryImages).where(and(eq(galleryImages.id,c.req.param('id')),eq(galleryImages.published,true),eq(galleryImages.archived,false))).limit(1);
  if(!image)return c.notFound();
  const object=await storage.send(new GetObjectCommand({Bucket:bucket,Key:image.objectKey}));
  if(!object.Body)return c.notFound();
  // Keep hidden/unpublished images from persisting in browser/CDN caches.
  return new Response(object.Body.transformToWebStream(),{headers:{'Content-Type':'image/webp','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'*'}});
});
app.get('/admin/gallery',async c=>{
  const images=await db.select().from(galleryImages).where(eq(galleryImages.archived,false)).orderBy(asc(galleryImages.sortOrder),desc(galleryImages.createdAt)).limit(500);
  const result=await Promise.all(images.map(async row=>({...publicImage(row),published:row.published,createdAt:row.createdAt,preview:await getSignedUrl(storage,new GetObjectCommand({Bucket:bucket,Key:row.objectKey}),{expiresIn:300})})));
  return c.json({images:result});
});
app.post('/admin/gallery',bodyLimit({maxSize:11*1024*1024,onError:c=>c.json({error:'Choose an image smaller than 10 MB.'},413)}),async c=>{
  const form=await c.req.formData();const file=form.get('image');
  if(!(file instanceof File)||file.size===0||file.size>10*1024*1024)return c.json({error:'Choose an image smaller than 10 MB.'},400);
  if(!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type))return c.json({error:'Use a JPEG, PNG, WebP or AVIF image.'},400);
  let details:ReturnType<typeof fields>;
  try{details=fields({...Object.fromEntries(form),alt:file.name,caption:form.get('caption') || file.name.slice(0,200)});}catch(error){return c.json({error:(error as Error).message},400);}
  let output:{data:Buffer;info:OutputInfo};
  try{
    const image=sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:40_000_000,animated:false});
    const metadata=await image.metadata();
    if(!['jpeg','png','webp','avif','heif'].includes(metadata.format || '')||(metadata.pages || 1)>1)throw new Error('Unsupported image');
    output=await image.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer({resolveWithObject:true});
  }catch{return c.json({error:'This image could not be processed. Use a valid still photo under 40 megapixels.'},400);}
  const id=randomUUID(),key=`gallery/${id}.webp`;
  await storage.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:output.data,ContentType:'image/webp',CacheControl:'private, max-age=300'}));
  try{
    const [image]=await db.insert(galleryImages).values({id,objectKey:key,...details,width:output.info.width,height:output.info.height,createdBy:c.get('userId'),published:form.get('published')==='true'}).returning();
    return c.json({image:{...publicImage(image),published:image.published}},201);
  }catch(error){
    // Only roll back the newly-created object if its metadata insert failed.
    await storage.send(new DeleteObjectCommand({Bucket:bucket,Key:key})).catch(()=>{});throw error;
  }
});
app.patch('/admin/gallery/:id',bodyLimit({maxSize:8192,onError:c=>c.json({error:'Update is too large.'},413)}),async c=>{
  if(!/^[0-9a-f-]{36}$/i.test(c.req.param('id')))return c.json({error:'Invalid image.'},400);
  const input=await c.req.json().catch(()=>null);
  if(!input||typeof input!=='object')return c.json({error:'Invalid update.'},400);
  let details:ReturnType<typeof fields>;
  try{details=fields(input);}catch(error){return c.json({error:(error as Error).message},400);}
  if(typeof input.published!=='boolean'||!Number.isInteger(input.sortOrder)||input.sortOrder < -100000 || input.sortOrder>100000)return c.json({error:'Choose a valid display order and publishing status.'},400);
  const [image]=await db.update(galleryImages).set({...details,published:input.published,sortOrder:input.sortOrder,updatedAt:new Date()}).where(and(eq(galleryImages.id,c.req.param('id')),eq(galleryImages.archived,false))).returning();
  if(!image)return c.json({error:'Image not found.'},404);
  return c.json({image:{...publicImage(image),published:image.published}});
});
app.notFound(c=>c.json({error:'Not found'},404));
export default app;
