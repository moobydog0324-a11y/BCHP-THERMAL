import { NextResponse } from 'next/server'
import { supabase, STORAGE_BUCKET } from '@/lib/supabase/client'

/**
 * GET /api/check-storage
 * Supabase Storage 상태 확인
 */
export async function GET() {
  try {
    console.log('🔍 Supabase Storage 상태 확인 중...')
    console.log(`   Bucket 이름: ${STORAGE_BUCKET}`)

    // 1. Bucket 목록 조회
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()

    if (listError) {
      console.error('❌ Bucket 목록 조회 실패:', listError)
      return NextResponse.json({
        success: false,
        error: 'Supabase Storage에 접근할 수 없습니다.',
        details: listError.message,
        supabase_error: listError,
      }, { status: 500 })
    }

    console.log(`✅ Bucket 목록 조회 성공: ${buckets?.length}개`)
    buckets?.forEach(b => console.log(`   - ${b.name}`))

    // 2. thermal-images bucket 존재 확인
    const targetBucket = buckets?.find(b => b.name === STORAGE_BUCKET)

    if (!targetBucket) {
      console.error(`❌ '${STORAGE_BUCKET}' bucket이 존재하지 않습니다!`)
      return NextResponse.json({
        success: false,
        error: `'${STORAGE_BUCKET}' bucket이 존재하지 않습니다.`,
        available_buckets: buckets?.map(b => b.name) || [],
        instruction: `Supabase Dashboard에서 '${STORAGE_BUCKET}' bucket을 생성하세요.`,
      }, { status: 404 })
    }

    console.log(`✅ '${STORAGE_BUCKET}' bucket 존재 확인`)

    // 3. 테스트 파일 업로드 시도
    const testFileName = `test_${Date.now()}.txt`
    const testContent = new Blob(['Supabase Storage 테스트'], { type: 'text/plain' })

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(`test/${testFileName}`, testContent, {
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      console.error('❌ 테스트 업로드 실패:', uploadError)
      return NextResponse.json({
        success: false,
        error: 'Supabase Storage 업로드 권한이 없습니다.',
        details: uploadError.message,
        supabase_error: uploadError,
        bucket_exists: true,
        instruction: `Supabase Dashboard에서 Storage 권한을 확인하세요.`,
      }, { status: 403 })
    }

    console.log(`✅ 테스트 업로드 성공: ${uploadData.path}`)

    // 4. 테스트 파일 삭제
    const { error: deleteError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([`test/${testFileName}`])

    if (deleteError) {
      console.warn('⚠️ 테스트 파일 삭제 실패:', deleteError)
    } else {
      console.log('✅ 테스트 파일 삭제 완료')
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase Storage가 정상 작동합니다!',
      bucket_name: STORAGE_BUCKET,
      bucket_exists: true,
      upload_permission: true,
      delete_permission: !deleteError,
      total_buckets: buckets?.length || 0,
    })

  } catch (error) {
    console.error('❌ Storage 확인 중 예외 발생:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Storage 확인 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.stack : String(error),
    }, { status: 500 })
  }
}



