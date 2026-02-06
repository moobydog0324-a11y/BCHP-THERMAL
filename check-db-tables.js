const fs = require('fs');
const path = require('path');

// .env.local 파일 수동 파싱
const envPath = path.join(__dirname, '.env.local');
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

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/therma_twin',
  ssl: false
});

async function checkTables() {
  try {
    console.log('🔍 데이터베이스 테이블 확인 중...\n');

    // 1. image_metadata 테이블 확인
    const metadataCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'image_metadata'
      );
    `);

    console.log('📋 image_metadata 테이블:', metadataCheck.rows[0].exists ? '✅ 존재' : '❌ 없음');

    if (metadataCheck.rows[0].exists) {
      // 컬럼 확인
      const columns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'image_metadata'
        ORDER BY ordinal_position;
      `);

      console.log('\n📋 image_metadata 컬럼:');
      columns.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}`);
      });

      // 데이터 개수 확인
      const count = await pool.query('SELECT COUNT(*) FROM image_metadata');
      console.log(`\n📊 저장된 메타데이터: ${count.rows[0].count}개`);
    }

    // 2. thermal_images 테이블 확인
    const imagesCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'thermal_images'
      );
    `);

    console.log('\n📋 thermal_images 테이블:', imagesCheck.rows[0].exists ? '✅ 존재' : '❌ 없음');

    if (imagesCheck.rows[0].exists) {
      const count = await pool.query('SELECT COUNT(*) FROM thermal_images');
      console.log(`📊 저장된 이미지: ${count.rows[0].count}개`);

      // GPS 컬럼 확인
      const gpsColumns = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'thermal_images' 
          AND column_name LIKE 'gps%'
        ORDER BY column_name;
      `);

      if (gpsColumns.rows.length > 0) {
        console.log('\n✅ GPS 전용 컬럼 존재:');
        gpsColumns.rows.forEach(col => {
          console.log(`   - ${col.column_name}`);
        });
      } else {
        console.log('\n⚠️ GPS 전용 컬럼 없음 (마이그레이션 필요)');
      }
    }

    // 3. 배치 처리 테이블 확인
    const batchCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'batch_processing_locks'
      );
    `);

    console.log('\n📋 batch_processing_locks 테이블:', batchCheck.rows[0].exists ? '✅ 존재' : '❌ 없음');

    // 4. 실패 추적 테이블 확인
    const failureCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'image_processing_failures'
      );
    `);

    console.log('📋 image_processing_failures 테이블:', failureCheck.rows[0].exists ? '✅ 존재' : '❌ 없음');

    console.log('\n='.repeat(60));
    console.log('결론:');
    console.log('='.repeat(60));

    if (!metadataCheck.rows[0].exists) {
      console.log('❌ image_metadata 테이블이 없습니다!');
      console.log('   해결: migrations/05-add-metadata-table.sql 실행 필요');
    } else {
      console.log('✅ 메타데이터 저장 준비 완료');
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    console.error('상세:', error);
  } finally {
    await pool.end();
  }
}

checkTables();



