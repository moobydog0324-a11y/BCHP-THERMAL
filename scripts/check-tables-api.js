const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. .env.local 로드
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^['"]|['"]$/g, '');
            process.env[key] = value;
        }
    });
}

async function checkTables() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error('❌ 환경변수가 설정되지 않았습니다.');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log('🔍 테이블 존재 여부 확인 중...');

    try {
        // thermal_images 테이블 조회 시도
        const { data, error } = await supabase
            .from('thermal_images')
            .select('image_id')
            .limit(1);

        if (error) {
            if (error.code === '42P01') { // undefined_table
                console.log('❌ thermal_images 테이블이 존재하지 않습니다.');
                console.log('💡 새 프로젝트라면 마이그레이션(테이블 생성)이 필요합니다.');
            } else {
                console.error('⚠️ 테이블 조회 오류:', error.message, error.code);
            }
        } else {
            console.log('✅ thermal_images 테이블이 존재합니다.');
        }

    } catch (err) {
        console.error('❌ 예상치 못한 오류:', err);
    }
}

checkTables();
