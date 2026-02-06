const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL is missing in .env.local');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false } // Required for Supabase (especially pooler)
});

async function migrate() {
    console.log('🔄 Connecting to database...');
    try {
        const client = await pool.connect();
        console.log('✅ Connected.');

        const query = `
      ALTER TABLE thermal_images 
      ADD COLUMN IF NOT EXISTS range_min FLOAT,
      ADD COLUMN IF NOT EXISTS range_max FLOAT,
      ADD COLUMN IF NOT EXISTS avg_temp FLOAT;
    `;

        console.log('🚀 Executing migration...');
        await client.query(query);
        console.log('✅ Migration successful! Columns added.');

        client.release();
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
