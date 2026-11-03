import dotenv from 'dotenv';import pg from 'pg';
dotenv.config({path:'.env.local',quiet:true});dotenv.config({path:'.env',quiet:true});
const email=process.argv[2]?.trim().toLowerCase();
if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Usage: npm run admin:grant -- email@example.com');
const client=new pg.Client({connectionString:process.env.DATABASE_URL_UNPOOLED});
try{await client.connect();await client.query('INSERT INTO gallery_admins (email) VALUES ($1) ON CONFLICT DO NOTHING',[email]);console.log(`Administrator authorized: ${email}. They must register and verify this email through Neon Auth.`);}finally{await client.end();}
