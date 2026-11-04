import './env';
import {serve} from '@hono/node-server';
import {Hono} from 'hono';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import api from './index';
const app=new Hono();
app.route('/api',api);
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.xml':'application/xml','.txt':'text/plain'};
app.get('*',async c=>{
  let pathname:string;
  try{pathname=decodeURIComponent(new URL(c.req.url).pathname);}catch{return c.notFound();}
  if(pathname==='/assets/backend-config.js'){c.header('Content-Type','application/javascript; charset=utf-8');c.header('Cache-Control','no-store');return c.body('window.HCT_BACKEND = '+JSON.stringify({apiBaseUrl:'/api',authUrl:process.env.NEON_AUTH_BASE_URL||''})+';\n');}
  if(pathname==='/.well-known/health')return c.json({ok:true});
  if(pathname==='/')pathname='/index.html';
  if(pathname==='/account'||pathname==='/account/')pathname='/account.html';
  if(pathname==='/admin'||pathname==='/admin/')pathname='/admin.html';
  // Never serve credentials, source, dependencies, config or arbitrary repo files.
  const safe=(/^\/[a-z0-9-]+\.html$/.test(pathname)||/^\/(assets|images)\/[a-zA-Z0-9_./-]+$/.test(pathname)||['/robots.txt','/sitemap.xml'].includes(pathname))&&!pathname.split('/').some(part=>part.startsWith('.'));
  if(!safe||!mime[extname(pathname)]||pathname.includes('image-manifest'))return c.notFound();
  try{
    const body=await readFile(resolve('.'+pathname));
    c.header('Content-Type',mime[extname(pathname)]);c.header('X-Content-Type-Options','nosniff');
    return c.body(body);
  }catch{return c.notFound();}
});
const port=Number(process.env.PORT || 3000);
serve({fetch:app.fetch,port,hostname:'127.0.0.1'},()=>console.log(`Happy Cape Tours running at http://localhost:${port}`));
