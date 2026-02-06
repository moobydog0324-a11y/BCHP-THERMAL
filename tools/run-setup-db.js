const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function setupDatabase() {
    console.log('🔌 Connecting to Supabase Database...');

    // Connection String 파싱 (비밀번호에 특수문자가 있을 수 있으므로 주의)
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('❌ Error: DATABASE_URL is not defined in .env.local');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }, // Supabase requires SSL, allow self-signed for now
    });

    try {
        const client = await pool.connect();
        console.log('✅ Connected successfully.');

        // SQL 파일 읽기
        const sqlPath = path.join(__dirname, '../scripts/setup-db.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('🚀 Executing setup-db.sql...');

        // SQL 실행
        await client.query(sql);

        console.log('✅ Database setup completed successfully!');
        client.release();
    } catch (err) {
        console.error('❌ Database setup failed:', err);
    } finally {
        await pool.end();
    }
}

setupDatabase();
