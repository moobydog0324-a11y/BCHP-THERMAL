const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL is missing in .env.local');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function applySchema() {
    console.log('🔄 Connecting to database...');
    const client = await pool.connect();
    try {
        console.log('✅ Connected.');

        const sqlPath = path.join(__dirname, '06-add-advanced-schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('🚀 Executing SQL script...');
        await client.query(sql);
        console.log('✅ Schema application successful!');

    } catch (err) {
        console.error('❌ Schema application failed:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

applySchema();
