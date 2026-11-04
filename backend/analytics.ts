import type {Pool} from 'pg';
import {findTour,tours} from './tours';
const kinds=new Set(['page_view','tour_click','tour_save','enquiry','whatsapp','phone','email','enquiry_click']);
const paths=new Set(['/', '/index.html','/tours.html','/about.html','/gallery.html','/contact.html','/privacy.html','/booking-information.html','/account.html','/account',...tours.map(t=>'/'+t.href)]);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type Event={id:string;sessionId:string;visitorId:string;kind:string;path:string;tourSlug:string|null;source:string;device:string};
export function parseEvents(input:unknown):Event[]|null{
 if(!input||typeof input!=='object'||!('events' in input)||!Array.isArray(input.events)||!input.events.length||input.events.length>20)return null;
 const result:Event[]=[];
 for(const e of input.events){
  if(!e||typeof e!=='object'||![e.id,e.sessionId,e.visitorId].every(v=>typeof v==='string'&&uuid.test(v))||!kinds.has(e.kind)||!paths.has(e.path)||!['mobile','tablet','desktop'].includes(e.device))return null;
  if((e.path==='/account'||e.path==='/account.html')&&e.kind!=='tour_save')return null;
  if(e.tourSlug!==null&&(typeof e.tourSlug!=='string'||!findTour(e.tourSlug)))return null;
  if(['tour_click','tour_save'].includes(e.kind)&&!e.tourSlug)return null;
  const source=typeof e.source==='string'&&/^(direct|[a-z0-9.-]{1,100})$/.test(e.source)?e.source:'direct';
  result.push({id:e.id,sessionId:e.sessionId,visitorId:e.visitorId,kind:e.kind,path:e.path,tourSlug:e.tourSlug,source,device:e.device});
 }
 return result;
}
export async function recordEvents(pool:Pool,events:Event[]){
 const client=await pool.connect();try{await client.query('BEGIN');
 // Serialize each session's quota to avoid concurrent requests bypassing the bound.
 for(const session of [...new Set(events.map(e=>e.sessionId))].sort())await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[session]);
 for(const event of events)await client.query(`INSERT INTO analytics_events(id,session_id,visitor_id,kind,path,tour_slug,source,device)
 SELECT $1,$2,$3,$4,$5,$6,$7,$8 WHERE (SELECT count(*) FROM analytics_events WHERE session_id=$2 AND created_at>now()-interval '1 hour')<300 ON CONFLICT(id) DO NOTHING`,[event.id,event.sessionId,event.visitorId,event.kind,event.path,event.tourSlug,event.source,event.device]);
 await client.query(`DELETE FROM analytics_events WHERE id IN (SELECT id FROM analytics_events WHERE created_at<now()-interval '180 days' LIMIT 1000)`);
 await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export function dateRange(from:string|undefined,to:string|undefined){
 const end=to||new Date().toISOString().slice(0,10);const start=from||new Date(Date.now()-29*86400000).toISOString().slice(0,10);
 const valid=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 if(!valid(start)||!valid(end))return null;const days=(Date.parse(end)-Date.parse(start))/86400000+1;
 if(days<1||days>180||end>new Date().toISOString().slice(0,10))return null;
 return {from:start,to:end,days,previousFrom:new Date(Date.parse(start)-days*86400000).toISOString().slice(0,10)};
}
export async function analyticsReport(pool:Pool,range:NonNullable<ReturnType<typeof dateRange>>){
 const summary=`jsonb_build_object('visits',count(DISTINCT session_id),'visitors',count(DISTINCT visitor_id),
 'pageViews',count(*) FILTER(WHERE kind='page_view'),'enquiries',count(*) FILTER(WHERE kind='enquiry'),
 'whatsapp',count(*) FILTER(WHERE kind='whatsapp'),'phone',count(*) FILTER(WHERE kind='phone'),'email',count(*) FILTER(WHERE kind='email'),
 'enquiryClicks',count(*) FILTER(WHERE kind='enquiry_click'),'tourClicks',count(*) FILTER(WHERE kind='tour_click'),'saves',count(*) FILTER(WHERE kind='tour_save'),
 'contactRate',CASE WHEN count(DISTINCT session_id)=0 THEN 0 ELSE round(100.0*count(DISTINCT session_id) FILTER(WHERE kind IN ('enquiry','whatsapp','phone','email'))/count(DISTINCT session_id),1) END)`;
 const result=await pool.query(`WITH scoped AS MATERIALIZED (
 SELECT *, (created_at AT TIME ZONE 'UTC')::date AS day FROM analytics_events
 WHERE created_at >= $1::date AND created_at < $2::date+interval '1 day' AND created_at >= now()-interval '180 days'
 ), current AS MATERIALIZED (SELECT * FROM scoped WHERE day >= $3::date),
 daily AS (SELECT day,${summary} AS metrics FROM current GROUP BY day),
 tour_counts AS (SELECT tour_slug AS slug,count(*) FILTER(WHERE kind='page_view')::int AS views,
 count(*) FILTER(WHERE kind='tour_click')::int AS clicks,count(*) FILTER(WHERE kind='tour_save')::int AS saves,
 count(*) FILTER(WHERE kind='enquiry')::int AS enquiries,count(*) FILTER(WHERE kind IN ('whatsapp','phone','email','enquiry_click'))::int AS "contactClicks"
 FROM current WHERE tour_slug IS NOT NULL GROUP BY tour_slug)
 SELECT (SELECT ${summary} FROM current) AS summary,
 (SELECT ${summary} FROM scoped WHERE day < $3::date) AS previous,
 (SELECT coalesce(jsonb_agg(jsonb_build_object('day',d::date::text)||coalesce(daily.metrics,'{}'::jsonb) ORDER BY d),'[]') FROM generate_series($3::date,$2::date,interval '1 day') d LEFT JOIN daily ON daily.day=d::date) AS daily,
 (SELECT coalesce(jsonb_agg(to_jsonb(tour_counts)),'[]') FROM tour_counts) AS tours,
 (SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]') FROM (SELECT source AS name,count(DISTINCT session_id)::int AS count FROM current GROUP BY source ORDER BY count DESC,source LIMIT 20)s) AS sources,
 (SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]') FROM (SELECT device AS name,count(DISTINCT session_id)::int AS count FROM current GROUP BY device ORDER BY count DESC,device)s) AS devices,
 (SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]') FROM (SELECT path AS name,count(*)::int AS count FROM current WHERE kind='page_view' GROUP BY path ORDER BY count DESC,path LIMIT 20)s) AS pages,
 (SELECT jsonb_build_array(jsonb_build_array('Visits',count(DISTINCT session_id)),
 jsonb_build_array('Viewed a tour',count(DISTINCT session_id) FILTER(WHERE kind='page_view' AND tour_slug IS NOT NULL)),
 jsonb_build_array('Saved a tour',count(DISTINCT session_id) FILTER(WHERE kind='tour_save')),
 jsonb_build_array('Contacted / clicked contact',count(DISTINCT session_id) FILTER(WHERE kind IN ('enquiry','whatsapp','phone','email')))) FROM current) AS journey`,[range.previousFrom,range.to,range.from]);
 const report=result.rows[0];const empty={visits:0,visitors:0,pageViews:0,enquiries:0,whatsapp:0,phone:0,email:0,tourClicks:0,enquiryClicks:0,saves:0,contactRate:0};
 report.daily=report.daily.map((day:Record<string,unknown>)=>({...empty,...day}));
 report.tours=tours.map(t=>({...t,views:0,clicks:0,saves:0,enquiries:0,contactClicks:0,...report.tours.find((row:{slug:string})=>row.slug===t.slug)})).sort((a,b)=>b.views-a.views||b.clicks-a.clicks);
 return {...report,range,generatedAt:new Date().toISOString()};
}
