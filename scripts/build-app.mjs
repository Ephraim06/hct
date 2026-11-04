import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import dotenv from 'dotenv';
dotenv.config({path:'.env.local',quiet:true});dotenv.config({path:'.env',quiet:true});
await mkdir('dist',{recursive:true});
const local=process.env.APP_API_URL;
// Only public service URLs are written to browser configuration. Never serialize process.env.
const apiBaseUrl=local || process.env.NEON_FUNCTION_GALLERY_BASE_URL || '';
const authUrl=process.env.NEON_AUTH_BASE_URL || '';
await writeFile('assets/backend-config.js',`window.HCT_BACKEND = ${JSON.stringify({apiBaseUrl:apiBaseUrl.replace(/\/$/,''),authUrl})};\n`);
await build({entryPoints:['admin/main.tsx'],bundle:true,format:'esm',platform:'browser',target:['es2022'],outfile:'assets/admin.bundle.js',minify:true,define:{'process.env.NODE_ENV':'"production"'},logLevel:'info'});
await build({entryPoints:['backend/dev.ts'],bundle:true,format:'esm',platform:'node',target:'node24',packages:'external',outfile:'dist/server.mjs',logLevel:'info'});
await build({entryPoints:['backend/index.ts'],bundle:true,format:'esm',platform:'node',target:'node24',packages:'external',outfile:'dist/api.mjs',logLevel:'silent'});

await build({entryPoints:['admin/lib/gallery-uploads.ts'],bundle:true,format:'esm',platform:'node',target:'node24',outfile:'dist/gallery-uploads.mjs',logLevel:'silent'});

await build({entryPoints:['admin/lib/session.ts'],bundle:true,format:'esm',platform:'node',target:'node24',outfile:'dist/session.mjs',logLevel:'silent'});

await build({entryPoints:{account:'admin/traveller.tsx','tour-saves':'admin/tour-saves.ts'},bundle:true,splitting:true,format:'esm',platform:'browser',target:['es2022'],outdir:'assets/traveller',minify:true,define:{'process.env.NODE_ENV':'"production"'},logLevel:'info'});
await build({entryPoints:['backend/analytics.ts'],bundle:true,format:'esm',platform:'node',target:'node24',packages:'external',outfile:'dist/analytics.mjs',logLevel:'silent'});
