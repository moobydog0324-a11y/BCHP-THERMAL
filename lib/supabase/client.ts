import { createClient } from '@supabase/supabase-js'

// Supabase 클라이언트 생성 (서버 사이드)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL 또는 Key가 설정되지 않았습니다.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// Storage bucket 이름
export const STORAGE_BUCKET = 'thermal-images'













