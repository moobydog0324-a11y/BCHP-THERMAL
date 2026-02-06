const fs = require('fs');
const path = require('path');

// .env.local 파일 수동 파싱
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^['"]|['"]$/g, ''); // 따옴표 제거
            process.env[key] = value;
        }
    });
}
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

async function resetDatabase() {
    console.log('🚀 Supabase 초기화 시작...\n');

    // 1. PostgreSQL 연결 설정
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    // 2. Supabase 클라이언트 설정
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Supabase URL 또는 Service Role Key가 설정되지 않았습니다.');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // ---------------------------------------------------------
        // DB 테이블 초기화
        // ---------------------------------------------------------
        console.log('🗑️  데이터베이스 테이블 데이터 삭제 중...');

        const targetTables = [
            'image_processing_failures',
            'batch_processing_locks',
            'image_metadata',
            'thermal_images'
        ];

        // 존재하는 테이블 확인
        const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ANY($1)
    `;

        const res = await pool.query(checkQuery, [targetTables]);
        const existingTables = res.rows.map(row => row.table_name);

        if (existingTables.length > 0) {
            console.log(`   - 삭제 대상 테이블: ${existingTables.join(', ')}`);

            // 존재하는 테이블만 Truncate
            const truncateQuery = `
        TRUNCATE TABLE ${existingTables.join(', ')}
        RESTART IDENTITY CASCADE;
      `;

            await pool.query(truncateQuery);
            console.log('✅ 테이블 초기화 완료');
        } else {
            console.log('⚠️ 초기화할 테이블이 발견되지 않았습니다.');
        }

        // ---------------------------------------------------------
        // Storage 초기화
        // ---------------------------------------------------------
        console.log('\n🗑️  Storage 버킷 파일 삭제 중...');
        const BUCKET_NAME = 'thermal-images';

        // 파일 목록 조회 (최대 1000개)
        // 폴더 구조가 있을 수 있으므로 재귀적 또는 반복적으로 처리해야 할 수도 있음
        // 여기서는 플랫한 구조라고 가정하고 처리하거나, 반복 처리

        let hasMore = true;
        let totalDeleted = 0;

        while (hasMore) {
            const { data: files, error: listError } = await supabase
                .storage
                .from(BUCKET_NAME)
                .list(undefined, { limit: 100, offset: 0 }); // 루트 폴더

            if (listError) {
                throw new Error(`Storage 목록 조회 실패: ${listError.message}`);
            }

            if (!files || files.length === 0) {
                hasMore = false;
                break;
            }

            const filePaths = files.map(file => file.name);

            const { error: removeError } = await supabase
                .storage
                .from(BUCKET_NAME)
                .remove(filePaths);

            if (removeError) {
                throw new Error(`파일 삭제 실패: ${removeError.message}`);
            }

            totalDeleted += filePaths.length;
            console.log(`   - ${filePaths.length}개 파일 삭제됨...`);
        }

        console.log(`✅ Storage 초기화 완료 (총 ${totalDeleted}개 파일 삭제)`);

    } catch (error) {
        console.error('\n❌ 오류 발생:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }

    console.log('\n✨ 모든 데이터가 성공적으로 초기화되었습니다.');
}

resetDatabase();
