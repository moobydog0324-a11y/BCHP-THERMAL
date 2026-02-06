const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function fixR2Urls() {
    const connectionString = process.env.DATABASE_URL;
    const publicDomain = process.env.R2_PUBLIC_DOMAIN;
    const accountId = process.env.R2_ACCOUNT_ID;
    const bucketName = process.env.R2_BUCKET_NAME;

    if (!connectionString || !publicDomain || !accountId || !bucketName) {
        console.error("❌ Missing environment variables (.env.local)");
        process.exit(1);
    }

    // 잘못된 URL 패턴 (S3 Endpoint)
    // https://<AccountID>.r2.cloudflarestorage.com/<BucketName>/
    const wrongPrefix = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/`;

    // 올바른 URL 패턴 (Public Domain)
    // https://<PublicDomain>/
    // 주의: Public Domain 뒤에 슬래시가 있는지 확인하여 처리
    const correctPrefix = publicDomain.endsWith('/') ? publicDomain : `${publicDomain}/`;

    console.log(`🔍 Old Prefix: ${wrongPrefix}`);
    console.log(`✅ New Prefix: ${correctPrefix}`);

    const pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();

        console.log("🚀 Updating image URLs...");

        // image_url 치환
        const updateImageUrls = `
            UPDATE thermal_images
            SET image_url = REPLACE(image_url, $1, $2)
            WHERE image_url LIKE $3
        `;
        const res1 = await client.query(updateImageUrls, [wrongPrefix, correctPrefix, `${wrongPrefix}%`]);
        console.log(`   - Updated ${res1.rowCount} image_urls`);

        // thumbnail_url 치환
        const updateThumbUrls = `
            UPDATE thermal_images
            SET thumbnail_url = REPLACE(thumbnail_url, $1, $2)
            WHERE thumbnail_url LIKE $3
        `;
        const res2 = await client.query(updateThumbUrls, [wrongPrefix, correctPrefix, `${wrongPrefix}%`]);
        console.log(`   - Updated ${res2.rowCount} thumbnail_urls`);

        console.log("✅ All done!");
        client.release();
    } catch (e) {
        console.error("❌ Error updating URLs:", e);
    } finally {
        await pool.end();
    }
}

fixR2Urls();
