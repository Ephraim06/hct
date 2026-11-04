import {build} from 'esbuild';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import dotenv from 'dotenv';
dotenv.config({path:'.env.local',quiet:true});dotenv.config({path:'.env',quiet:true});
await mkdir('dist',{recursive:true});
const local=process.env.APP_API_URL;
// Only public service URLs are written to browser configuration. Never serialize process.env.
const apiBaseUrl=local || process.env.NEON_FUNCTION_GALLERY_BASE_URL || '';
const authUrl=process.env.NEON_AUTH_BASE_URL || '';
await writeFile('assets/backend-config.js',`window.HCT_BACKEND = ${JSON.stringify({apiBaseUrl:apiBaseUrl.replace(/\/$/,''),authUrl})};\n`);
if(apiBaseUrl){const contact=await readFile('contact.html','utf8');await writeFile('contact.html',contact.replace(/<form action="[^"]+" method="POST" id="contactForm"/,`<form action="${apiBaseUrl.replace(/\/$/,'')}/enquiries" method="POST" id="contactForm"`));}
await build({entryPoints:['admin/main.tsx'],bundle:true,format:'esm',platform:'browser',target:['es2022'],outdir:'assets',entryNames:'admin.bundle',chunkNames:'charts/[name]-[hash]',splitting:true,minify:true,define:{'process.env.NODE_ENV':'"production"'},logLevel:'info'});
await build({entryPoints:['backend/dev.ts'],bundle:true,format:'esm',platform:'node',target:'node24',packages:'external',outfile:'dist/server.mjs',logLevel:'info'});
await build({entryPoints:['backend/index.ts'],bundle:true,format:'esm',platform:'node',target:'node24',packages:'external',outfile:'dist/api.mjs',logLevel:'silent'});

await build({entryPoints:['admin/lib/gallery-uploads.ts'],bundle:true,format:'esm',platform:'node',target:'node24',outfile:'dist/gallery-uploads.mjs',logLevel:'silent'});

await build({entryPoints:['admin/lib/session.ts'],bundle:true,format:'esm',platform:'node',target:'node24',outfile:'dist/session.mjs',logLevel:'silent'});

await build({entryPoints:{account:'admin/traveller.tsx','tour-saves':'admin/tour-saves.ts'},bundle:true,splitting:true,format:'esm',platform:'browser',target:['es2022'],outdir:'assets/traveller',minify:true,define:{'process.env.NODE_ENV':'"production"'},logLevel:'info'});
await build({entryPoints:['backend/analytics.ts'],bundle:true,format:'esm',platform:'node',target:'node24',packages:'external',outfile:'dist/analytics.mjs',logLevel:'silent'});

await build({entryPoints:['backend/enquiries.ts','backend/gallery-management.ts'],bundle:true,format:'esm',platform:'node',target:'node24',packages:'external',outdir:'dist',outExtension:{'.js':'.mjs'},logLevel:'silent'});

await build({entryPoints:['admin/lib/google-auth.ts'],bundle:true,format:'esm',platform:'node',target:'node24',outfile:'dist/google-auth.mjs',logLevel:'silent'});

await build({entryPoints:{'analytics-charts':'admin/lib/analytics-charts.ts','analytics-config':'backend/analytics-config.ts'},bundle:true,format:'esm',platform:'node',target:'node24',outdir:'dist',outExtension:{'.js':'.mjs'},logLevel:'silent'});

await build({entryPoints:['admin/public-controls.ts'],bundle:true,format:'esm',platform:'browser',target:['es2022'],outfile:'assets/controls.js',minify:true,logLevel:'info'});

await build({entryPoints:{'admin-controls':'admin/components/ui/admin-controls.ts'},bundle:true,format:'esm',platform:'node',target:'node24',packages:'external',outdir:'dist',outExtension:{'.js':'.mjs'},logLevel:'silent'});

await build({entryPoints:['public/gallery-viewer.js'],bundle:true,splitting:true,format:'esm',platform:'browser',target:['es2022'],outdir:'assets',entryNames:'gallery-viewer',chunkNames:'gallery/[name]-[hash]',minify:true,logLevel:'info'});
