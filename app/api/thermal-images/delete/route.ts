import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * DELETE /api/thermal-images/delete
 * 이미지 삭제 (DB + Supabase Storage)
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { image_id } = body

    if (!image_id) {
      return NextResponse.json(
        { success: false, error: 'image_id가 필요합니다.' },
        { status: 400 }
      )
    }

    console.log(`🗑️ 이미지 삭제 요청: ID ${image_id}`)

    // 1. DB에서 이미지 정보 조회
    const imageResult = await query(
      `SELECT image_id, image_url, thumbnail_url 
       FROM thermal_images 
       WHERE image_id = $1`,
      [image_id]
    )

    if (imageResult.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: '이미지를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const imageData = imageResult.rows[0]
    console.log(`📄 이미지 정보:`, imageData)

    // 2. Supabase Storage에서 파일 삭제
    try {
      // 이미지 URL에서 파일 경로 추출
      const imageUrl = new URL(imageData.image_url)
      const imagePath = imageUrl.pathname.split('/storage/v1/object/public/thermal-images/')[1]
      
      if (imagePath) {
        const { error: deleteImageError } = await supabase.storage
          .from('thermal-images')
          .remove([imagePath])
        
        if (deleteImageError) {
          console.warn(`⚠️ 원본 이미지 삭제 실패:`, deleteImageError)
        } else {
          console.log(`✅ 원본 이미지 삭제 완료: ${imagePath}`)
        }
      }

      // 썸네일 삭제
      if (imageData.thumbnail_url) {
        const thumbnailUrl = new URL(imageData.thumbnail_url)
        const thumbnailPath = thumbnailUrl.pathname.split('/storage/v1/object/public/thermal-images/')[1]
        
        if (thumbnailPath) {
          const { error: deleteThumbnailError } = await supabase.storage
            .from('thermal-images')
            .remove([thumbnailPath])
          
          if (deleteThumbnailError) {
            console.warn(`⚠️ 썸네일 삭제 실패:`, deleteThumbnailError)
          } else {
            console.log(`✅ 썸네일 삭제 완료: ${thumbnailPath}`)
          }
        }
      }
    } catch (storageError) {
      console.warn(`⚠️ Storage 파일 삭제 중 오류 (계속 진행):`, storageError)
    }

    // 3. DB에서 메타데이터 삭제 (CASCADE로 자동 삭제됨)
    await query(
      `DELETE FROM image_metadata WHERE image_id = $1`,
      [image_id]
    )

    // 4. DB에서 이미지 레코드 삭제
    await query(
      `DELETE FROM thermal_images WHERE image_id = $1`,
      [image_id]
    )

    console.log(`✅ 이미지 ID ${image_id} 삭제 완료`)

    return NextResponse.json({
      success: true,
      message: '이미지가 성공적으로 삭제되었습니다.',
      deleted_image_id: image_id,
    })
  } catch (error) {
    console.error('❌ 이미지 삭제 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '이미지 삭제 중 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}

