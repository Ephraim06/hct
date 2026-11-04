import {Hono} from 'hono';
import {bodyLimit} from 'hono/body-limit';
import type {Pool} from 'pg';
import {S3Client,PutObjectCommand,GetObjectCommand,ListObjectsV2Command,DeleteObjectCommand} from '@aws-sdk/client-s3';
import {createHash,randomUUID} from 'node:crypto';
import {isAllowedOrigin} from './origins';
import {tours} from './tours';
export const enquiryStatuses=['new','contacted','awaiting_reply','confirmed','closed','spam'] as const;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type EnquiryInput={id:string;firstName:string;lastName:string;email:string;phone:string;tour:string;tourSlug:string|null;travelDate:string;partySize:number;message:string};
export type Delivery={status:'sent'|'failed'|'unknown'|'sending';error?:string};
type Receipt={id:string;hash:string;createdAt:string;stored:boolean;delivery:Delivery;attempt?:string;data?:EnquiryInput};
const tourNames=new Map<string,string>(tours.map(t=>[t.title,t.slug]));tourNames.set('Private Cape of Good Hope & Penguins','cape-point-penguins-private-tour');
export function parseEnquiry(value:unknown):EnquiryInput{
 if(!value||typeof value!=='object')throw Error('Please complete the form.');const v=value as Record<string,unknown>;
 const text=(key:string,min:number,max:number)=>{if(typeof v[key]!=='string'||String(v[key]).trim().length<min||String(v[key]).trim().length>max)throw Error(`Please check ${key.replace(/([A-Z])/g,' $1').toLowerCase()}.`);return String(v[key]).trim();};
 const id=text('id',36,36);if(!uuid.test(id))throw Error('Invalid submission reference.');
 const firstName=text('firstName',1,100),lastName=text('lastName',1,100),email=text('email',3,254).toLowerCase(),phone=text('phone',0,40),tour=text('tour',0,150),message=text('message',1,5000),travelDate=text('travelDate',10,10);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid email address.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(travelDate)||!Number.isFinite(Date.parse(travelDate))||new Date(travelDate).toISOString().slice(0,10)!==travelDate)throw Error('Choose a valid travel date.');
 if(tour&&!tourNames.has(tour)&&tour!=='Private / custom tour')throw Error('Choose a listed tour.');
 const partySize=Number(v.partySize);if(!Number.isInteger(partySize)||partySize<1||partySize>100)throw Error('Choose 1–100 guests.');
 return {id,firstName,lastName,email,phone,tour,tourSlug:tourNames.get(tour)||null,travelDate,partySize,message};
}
export async function forwardEnquiry(input:EnquiryInput):Promise<Delivery>{
 try{
 const response=await fetch('https://formspree.io/f/meaaveoz',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',Origin:'https://www.happycapetours.com',Referer:'https://www.happycapetours.com/contact.html'},body:JSON.stringify({'first-name':input.firstName,'last-name':input.lastName,email:input.email,'mobile-number':input.phone,tour:input.tour,'travel-date':input.travelDate,'party-size':String(input.partySize),message:input.message,_subject:`Happy Cape Tours enquiry ${input.id.slice(0,8).toUpperCase()}`,'enquiry-reference':input.id}),signal:AbortSignal.timeout(15000)});
 if(response.ok)return {status:'sent'};
 if(response.status>=500)return {status:'unknown',error:`Formspree returned HTTP ${response.status}; delivery could not be confirmed.`};
 return {status:'failed',error:`Formspree returned HTTP ${response.status}.`};
 }catch{return {status:'unknown',error:'Delivery could not be confirmed.'};}
}
export function enquiryService(pool:Pool,storage:S3Client,forward=forwardEnquiry){
 const key=(id:string)=>`enquiries/receipts/${id}.json`;
 const pendingKey=(id:string)=>`enquiries/pending/${id}.json`;
 const clearPending=(id:string)=>storage.send(new DeleteObjectCommand({Bucket:'assets',Key:pendingKey(id)}));
 const put=(r:Receipt,create=false)=>storage.send(new PutObjectCommand({Bucket:'assets',Key:key(r.id),Body:JSON.stringify(r),ContentType:'application/json',CacheControl:'no-store',...(create?{IfNoneMatch:'*'}:{})}));
 async function get(id:string):Promise<Receipt|null>{try{const r=await storage.send(new GetObjectCommand({Bucket:'assets',Key:key(id)}));return JSON.parse(await r.Body!.transformToString());}catch(e){if((e as {$metadata?:{httpStatusCode:number}}).$metadata?.httpStatusCode===404)return null;throw e;}}
 async function save(input:EnquiryInput,hash:string,createdAt:string){await pool.query(`WITH inserted AS (INSERT INTO enquiries(id,payload_hash,first_name,last_name,email,phone,tour,tour_slug,travel_date,party_size,message,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO NOTHING RETURNING id) INSERT INTO enquiry_activity(id,enquiry_id,actor,kind,body) SELECT $13,id,'Website','created','Enquiry received' FROM inserted`,[input.id,hash,input.firstName,input.lastName,input.email,input.phone,input.tour,input.tourSlug,input.travelDate,input.partySize,input.message,createdAt,randomUUID()]);}
 async function sync(receipt:Receipt){
 if(!receipt.data)return receipt;
 await save(receipt.data,receipt.hash,receipt.createdAt);
 await pool.query(`UPDATE enquiries SET delivery_status=$2,delivery_error=$3,delivery_updated_at=now() WHERE id=$1 AND delivery_attempt IS NULL`,[receipt.id,receipt.delivery.status==='sending'?'unknown':receipt.delivery.status,receipt.delivery.error||null]);
 const done={...receipt,stored:true,data:undefined};await put(done);await clearPending(receipt.id).catch(()=>{});return done;
 }
 async function submit(input:EnquiryInput){
 const hash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
 const receipt:Receipt={id:input.id,hash,createdAt:new Date().toISOString(),stored:false,delivery:{status:'sending'},data:input};
 try{await put(receipt,true);}catch(e){if((e as {$metadata?:{httpStatusCode:number}}).$metadata?.httpStatusCode!==412)throw e;const previous=await get(input.id);if(!previous||previous.hash!==hash)throw Object.assign(Error('This reference was already used. Please reload the form.'),{status:409});if(previous.data&&(previous.delivery.status!=='sending'||Date.now()-Date.parse(previous.createdAt)>60000))return sync(previous);return previous;}
 await storage.send(new PutObjectCommand({Bucket:'assets',Key:pendingKey(input.id),Body:JSON.stringify({id:input.id}),ContentType:'application/json'})).catch(()=>{});
 // Both operations start together after a private durable receipt reserves the reference.
 const [saved,delivered]=await Promise.allSettled([save(input,hash,receipt.createdAt),forward(input)]);
 receipt.stored=saved.status==='fulfilled';receipt.delivery=delivered.status==='fulfilled'?delivered.value:{status:'unknown',error:'Delivery could not be confirmed.'};
 // Keep the payload in private storage until both the database row and its delivery state are durable.
 await put(receipt);
 if(receipt.stored){try{return await sync(receipt);}catch{return receipt;}}
 return receipt;
 }
 async function recoverPending(){const list=await storage.send(new ListObjectsV2Command({Bucket:'assets',Prefix:'enquiries/pending/',MaxKeys:25}));let recovered=0;for(const item of list.Contents||[]){const id=item.Key!.split('/').pop()!.replace('.json','');if(!uuid.test(id))continue;const receipt=await get(id);if(receipt?.data&&(receipt.delivery.status!=='sending'||Date.now()-Date.parse(receipt.createdAt)>60000)){await sync(receipt);recovered++;}else if(receipt&&!receipt.data)await clearPending(id);}return recovered;}
 return {submit,sync,get,key,pendingKey,recoverPending};
}
export function enquiryRoutes(pool:Pool,storage:S3Client,forward=forwardEnquiry){
 const service=enquiryService(pool,storage,forward);const publicRoutes=new Hono();const admin=new Hono<{Variables:{email:string}}>();
 publicRoutes.post('/',bodyLimit({maxSize:32768,onError:c=>c.json({error:'Your message is too long.'},413)}),async c=>{
 c.header('Cache-Control','no-store');if(!isAllowedOrigin(c.req.header('Origin')||''))return c.json({error:'Origin not allowed.'},403);
 const json=c.req.header('Content-Type')?.includes('application/json');
 const raw=json?await c.req.json().catch(()=>null):await c.req.parseBody().then(v=>({id:randomUUID(),firstName:v['first-name'],lastName:v['last-name'],email:v.email,phone:v['mobile-number']||'',tour:v.tour||'',travelDate:v['travel-date'],partySize:Number(v['party-size']),message:v.message,website:v.website})).catch(()=>null);
 let input:EnquiryInput;try{input=parseEnquiry(raw);}catch(e){return c.json({error:(e as Error).message},400);}
 try{const recent=await pool.query("SELECT count(*)::int AS count FROM enquiries WHERE email=$1 AND id<>$2 AND created_at>now()-interval '1 hour'",[input.email,input.id]).catch(()=>null);if(recent&&recent.rows[0].count>=5)return c.json({error:'Too many enquiries. Please try again later or call us.'},429);const receipt=await service.submit(input);if(!receipt.stored&&!['sent','sending'].includes(receipt.delivery.status))return c.json({error:'We could not confirm receipt. Please retry.',reference:receipt.id},503);if(!json&&receipt.stored)return c.redirect(new URL('/contact.html?received='+receipt.id.slice(0,8),c.req.header('Origin')!).href,303);return c.json({accepted:receipt.stored,reference:receipt.id,stored:receipt.stored,notification:receipt.delivery.status},receipt.stored?200:202);}catch(e){if((e as {status?:number}).status===409)return c.json({error:(e as Error).message},409);return c.json({error:'We could not confirm receipt. Your details are still in the form. Please retry.'},503);}
 });
 async function detail(id:string){const result=await pool.query('SELECT *,travel_date::text AS travel_date FROM enquiries WHERE id=$1',[id]);if(!result.rows[0])return null;const activity=await pool.query('SELECT id,actor,kind,body,created_at FROM enquiry_activity WHERE enquiry_id=$1 ORDER BY created_at DESC,id LIMIT 300',[id]);return {enquiry:result.rows[0],activity:activity.rows};}
 function filters(c:{req:{query:(key:string)=>string|undefined}}){const search=(c.req.query('search')||'').trim().slice(0,100),status=c.req.query('status')||'',tour=c.req.query('tour')||'',travel=c.req.query('travel')||'',from=c.req.query('from')||'',to=c.req.query('to')||'';
 if(status&&!enquiryStatuses.includes(status as typeof enquiryStatuses[number]))throw Error('Invalid status.');
 if(tour&&!tours.some(t=>t.slug===tour))throw Error('Invalid tour.');
 for(const v of [travel,from,to])if(v&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v))throw Error('Invalid date.');
 if(from&&to&&from>to)throw Error('Invalid date range.');
 return {sql:`WHERE ($1='' OR first_name ILIKE $2 OR last_name ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2 OR message ILIKE $2 OR (first_name||' '||last_name) ILIKE $2 OR id::text ILIKE $2) AND ($3='' OR status=$3) AND ($4='' OR tour_slug=$4) AND ($5='' OR travel_date=NULLIF($5,'')::date) AND ($6='' OR created_at>=NULLIF($6,'')::date) AND ($7='' OR created_at<NULLIF($7,'')::date+interval '1 day')`,values:[search,'%'+search.replace(/[\\%_]/g,'\\$&')+'%',status,tour,travel,from,to]};}
 admin.get('/',async c=>{let recoveryWarning=false;try{await service.recoverPending();}catch{recoveryWarning=true;}let f;try{f=filters(c);}catch(e){return c.json({error:(e as Error).message},400);}const page=Number(c.req.query('page')||1);if(!Number.isInteger(page)||page<1||page>10000)return c.json({error:'Invalid page.'},400);
 await pool.query(`UPDATE enquiries SET delivery_status='unknown',delivery_error='Delivery was interrupted.',delivery_updated_at=now() WHERE delivery_status='sending' AND delivery_updated_at<now()-interval '2 minutes'`);
 const [list,count,stats]=await Promise.all([pool.query(`SELECT *,travel_date::text AS travel_date FROM enquiries ${f.sql} ORDER BY created_at DESC,id LIMIT 25 OFFSET $8`,[...f.values,(page-1)*25]),pool.query(`SELECT count(*)::int AS total FROM enquiries ${f.sql}`,f.values),pool.query('SELECT status,count(*)::int AS count FROM enquiries GROUP BY status')]);return c.json({enquiries:list.rows,total:count.rows[0].total,page,pageSize:25,stats:stats.rows,recoveryWarning});});
 admin.get('/export',async c=>{let f;try{f=filters(c);}catch(e){return c.json({error:(e as Error).message},400);}const result=await pool.query(`SELECT id,first_name,last_name,email,phone,tour,travel_date::text,party_size,message,status,delivery_status,created_at FROM enquiries ${f.sql} ORDER BY created_at DESC LIMIT 10001`,f.values);if(result.rows.length>10000)return c.json({error:'Narrow the filters to export up to 10,000 enquiries.'},400);return c.json({enquiries:result.rows});});
 admin.post('/recover',async c=>{const body=await c.req.json().catch(()=>({}));if(body.cursor&&typeof body.cursor!=='string')return c.json({error:'Invalid cursor.'},400);const list=await storage.send(new ListObjectsV2Command({Bucket:'assets',Prefix:'enquiries/receipts/',MaxKeys:50,ContinuationToken:body.cursor||undefined}));let recovered=0;for(const item of list.Contents||[]){const id=item.Key!.split('/').pop()!.replace('.json','');if(!uuid.test(id))continue;const receipt=await service.get(id);if(receipt?.data&&Date.now()-Date.parse(receipt.createdAt)>60000){await service.sync(receipt);recovered++;}}return c.json({recovered,cursor:list.NextContinuationToken||null});});
 admin.get('/:id',async c=>{if(!uuid.test(c.req.param('id')))return c.notFound();const result=await detail(c.req.param('id'));return result?c.json(result):c.notFound();});
 admin.patch('/:id',bodyLimit({maxSize:32768}),async c=>{const id=c.req.param('id'),body=await c.req.json().catch(()=>null);if(!uuid.test(id)||!body||!Number.isInteger(body.version))return c.json({error:'Invalid update.'},400);const status=body.status;if(!enquiryStatuses.includes(status))return c.json({error:'Choose a valid status.'},400);const client=await pool.connect();try{await client.query('BEGIN');const result=await client.query('SELECT status,version FROM enquiries WHERE id=$1 FOR UPDATE',[id]);const row=result.rows[0];if(!row){await client.query('ROLLBACK');return c.notFound();}if(row.version!==body.version){await client.query('ROLLBACK');return c.json({error:'This enquiry changed. Reopen it to see the latest version.'},409);}if(row.status!==status){await client.query('UPDATE enquiries SET status=$2,version=version+1,updated_at=now() WHERE id=$1',[id,status]);await client.query('INSERT INTO enquiry_activity(id,enquiry_id,actor,kind,body) VALUES($1,$2,$3,$4,$5)',[randomUUID(),id,c.get('email'),'status',`${row.status} → ${status}`]);}await client.query('COMMIT');return c.json(await detail(id));}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}});
 admin.post('/:id/notes',bodyLimit({maxSize:32768}),async c=>{const id=c.req.param('id'),body=await c.req.json().catch(()=>null);if(!uuid.test(id)||typeof body?.note!=='string'||!body.note.trim()||body.note.trim().length>5000)return c.json({error:'Write a note of up to 5,000 characters.'},400);const result=await pool.query(`INSERT INTO enquiry_activity(id,enquiry_id,actor,kind,body) SELECT $1,id,$3,'note',$4 FROM enquiries WHERE id=$2 RETURNING id`,[randomUUID(),id,c.get('email'),body.note.trim()]);return result.rowCount?c.json(await detail(id)):c.notFound();});
 admin.post('/:id/retry',bodyLimit({maxSize:2048}),async c=>{const id=c.req.param('id'),body=await c.req.json().catch(()=>null);if(!uuid.test(id)||!uuid.test(body?.attempt||''))return c.json({error:'Invalid retry.'},400);const existing=(await pool.query('SELECT *,travel_date::text AS travel_date FROM enquiries WHERE id=$1',[id])).rows[0];if(!existing)return c.notFound();const lastReceipt=await service.get(id).catch(()=>null);if(lastReceipt?.delivery.status==='sent'&&(lastReceipt.attempt||null)===(existing.delivery_attempt||null)){await pool.query("UPDATE enquiries SET delivery_status='sent',delivery_error=NULL,delivery_updated_at=now() WHERE id=$1",[id]);return c.json(await detail(id));}if(existing.delivery_attempt===body.attempt)return c.json(await detail(id));if(existing.delivery_status==='sent')return c.json({error:'Already delivered.'},409);if(existing.delivery_status==='unknown'&&body.confirmDuplicateRisk!==true)return c.json({error:'Delivery is unconfirmed. Confirm the duplicate-message risk before retrying.'},409);
 const claimed=await pool.query(`UPDATE enquiries SET delivery_status='sending',delivery_attempt=$2,delivery_updated_at=now() WHERE id=$1 AND delivery_status IN ('failed','unknown') RETURNING *,travel_date::text AS travel_date`,[id,body.attempt]);if(!claimed.rowCount)return c.json({error:'A notification is already being sent.'},409);const row=claimed.rows[0];const input:EnquiryInput={id,firstName:row.first_name,lastName:row.last_name,email:row.email,phone:row.phone,tour:row.tour,tourSlug:row.tour_slug,travelDate:String(row.travel_date instanceof Date?row.travel_date.toISOString().slice(0,10):row.travel_date),partySize:row.party_size,message:row.message};const delivery=await forward(input);const receipt=await service.get(id).catch(()=>null);if(receipt)await storage.send(new PutObjectCommand({Bucket:'assets',Key:service.key(id),Body:JSON.stringify({...receipt,stored:true,data:undefined,delivery,attempt:body.attempt}),ContentType:'application/json'}));
 await pool.query('UPDATE enquiries SET delivery_status=$2,delivery_error=$3,delivery_updated_at=now() WHERE id=$1 AND delivery_attempt=$4',[id,delivery.status,delivery.error||null,body.attempt]);await pool.query(`INSERT INTO enquiry_activity(id,enquiry_id,actor,kind,body) VALUES($1,$2,$3,'delivery',$4)`,[randomUUID(),id,c.get('email'),`Notification ${delivery.status}`]);return c.json(await detail(id));});
 return {publicRoutes,admin,service};
}
