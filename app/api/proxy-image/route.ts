import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url')

    if (!url) {
        return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
    }

    try {
        const response = await fetch(url)
        if (!response.ok) {
            return NextResponse.json({ error: `Failed to fetch image: ${response.statusText}` }, { status: response.status })
        }

        const blob = await response.blob()
        const headers = new Headers()
        headers.set('Content-Type', response.headers.get('Content-Type') || 'image/jpeg')
        headers.set('Cache-Control', 'public, max-age=31536000, immutable')

        return new NextResponse(blob, {
            status: 200,
            headers
        })
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}
