const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function setupAnalysisDatabase() {
    console.log('🔌 Connecting to Supabase Database for Analysis System Setup...');

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('❌ Error: DATABASE_URL is not defined in .env.local');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false },
    });

    try {
        const client = await pool.connect();
        console.log('✅ Connected successfully.');

        const sqlPath = path.join(__dirname, '../scripts/setup-analysis-db.sql');
        if (!fs.existsSync(sqlPath)) {
            console.error(`❌ Error: SQL file not found at ${sqlPath}`);
            process.exit(1);
        }

        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('🚀 Executing setup-analysis-db.sql...');
        await client.query(sql);

        console.log('✅ Analysis System Database setup completed successfully!');
        client.release();
    } catch (err) {
        console.error('❌ Database setup failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

setupAnalysisDatabase();
