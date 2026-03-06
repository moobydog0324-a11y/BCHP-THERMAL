import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { NextResponse } from "next/server"

// R2 클라이언트 (지연 초기화)
let r2Client: S3Client | null = null

function getR2Client() {
    if (r2Client) return r2Client

    const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
    const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
    const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        throw new Error("R2 Credentials missing")
    }

    r2Client = new S3Client({
        region: "auto",
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
    })

    return r2Client
}

export async function POST(request: Request) {
    try {
        const { filename, filetype, folder = "thermal" } = await request.json()

        // 허용된 MIME 타입 검증 (이미지 파일만 허용)
        const ALLOWED_MIME_TYPES = [
            'image/jpeg', 'image/jpg', 'image/png',
            'image/tiff', 'image/x-tiff', 'application/octet-stream'
        ]
        if (!filetype || !ALLOWED_MIME_TYPES.includes(filetype.toLowerCase())) {
            return NextResponse.json(
                { error: '허용되지 않는 파일 형식입니다. (jpg, png, tiff만 허용)' },
                { status: 415 }
            )
        }

        // 환경변수 체크
        if (!process.env.R2_BUCKET_NAME) {
            return NextResponse.json(
                { error: "R2_BUCKET_NAME이 설정되지 않았습니다." },
                { status: 500 }
            )
        }

        // 파일 경로 생성: folder/YYYY/MM/DD/filename
        const date = new Date()
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')

        // 파일명 안전하게 변환 (한글 등 특수문자 제거)
        const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
        const uniqueId = Math.random().toString(36).substring(2, 8)
        const key = `${folder}/${year}/${month}/${day}/${Date.now()}_${uniqueId}_${safeFilename}`

        const client = getR2Client()
        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            ContentType: filetype,
        })

        // 1시간 유효한 업로드 URL 생성
        const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 })

        // Public URL 구성 (설정된 도메인이 없으면 R2 Pub URL 사용 - 사용자 설정 필요)
        // R2_PUBLIC_DOMAIN이 있으면 사용, 없으면 worker 도메인이나 직접 접근 도메인
        const publicDomain = process.env.R2_PUBLIC_DOMAIN || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}`
        const publicUrl = `${publicDomain}/${key}`

        return NextResponse.json({
            uploadUrl,
            key,
            publicUrl,
            bucket: process.env.R2_BUCKET_NAME
        })

    } catch (error) {
        console.error("R2 Presigned URL 생성 실패:", error)

        // 구체적인 에러 메시지 반환
        let errorMessage = "URL 생성 실패"
        if (error instanceof Error) {
            if (error.message === "R2 Credentials missing") {
                errorMessage = "R2 접속 정보(Keys)가 .env.local에 설정되지 않았습니다."
            } else {
                errorMessage = error.message
            }
        }

        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
