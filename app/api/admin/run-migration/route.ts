import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import fs from 'fs'
import path from 'path'

export async function GET(request: NextRequest) {
    try {
        const sqlPath = path.join(process.cwd(), 'scripts', '06-add-advanced-schema.sql')
        const sql = fs.readFileSync(sqlPath, 'utf8')

        await query(sql)

        return NextResponse.json({ success: true, message: 'Migration applied successfully' })
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
