import { NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

export async function GET() {
    try {
        await query(`
      CREATE OR REPLACE FUNCTION sync_gps_from_metadata() RETURNS trigger AS $$
      BEGIN
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `)
        return NextResponse.json({ success: true, message: "Trigger fixed" })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message })
    }
}
