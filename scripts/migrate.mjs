import 'dotenv/config';
import dotenv from 'dotenv';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
dotenv.config({path:'.env.local',quiet:true});
if(!process.env.DATABASE_URL_UNPOOLED)throw new Error('Pull the Neon environment first.');
const client=new pg.Client({connectionString:process.env.DATABASE_URL_UNPOOLED});
try{
 await client.connect();await client.query('BEGIN');
 await client.query(await readFile('backend/database/001-gallery.sql','utf8'));
 await client.query(await readFile('backend/database/002-saved-tours.sql','utf8'));
 await client.query('COMMIT');console.log('Gallery and saved-tour migrations applied successfully.');
}catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{await client.end();}
