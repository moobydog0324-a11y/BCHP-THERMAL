"use client"

import React, { useEffect, useRef, useState } from "react"
import { MapPin } from "lucide-react"

interface KakaoMapProps {
    latitude: number
    longitude: number
    className?: string
    width?: string
    height?: string
}

export default function KakaoMap({
    latitude,
    longitude,
    className = "",
    width = "100%",
    height = "300px"
}: KakaoMapProps) {
    const mapRef = useRef<HTMLDivElement>(null)
    const [mapLoaded, setMapLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // Wait for the Kakao maps script to load
        const checkKakaoMaps = () => {
            // @ts-ignore - kakao is loaded globally via script tag
            if (window.kakao && window.kakao.maps) {
                // @ts-ignore
                window.kakao.maps.load(() => {
                    setMapLoaded(true)
                })
            } else {
                // Retry a few times if script hasn't loaded yet
                setTimeout(checkKakaoMaps, 500)
            }
        }

        checkKakaoMaps()
    }, [])

    useEffect(() => {
        if (!mapLoaded || !mapRef.current) return

        try {
            // @ts-ignore
            const kakao = window.kakao

            const options = {
                center: new kakao.maps.LatLng(latitude, longitude),
                level: 3 // zoom level (1-14)
            }

            const map = new kakao.maps.Map(mapRef.current, options)

            // Create a marker
            const markerPosition = new kakao.maps.LatLng(latitude, longitude)
            const marker = new kakao.maps.Marker({
                position: markerPosition
            })

            marker.setMap(map)

            // Add map controls
            const mapTypeControl = new kakao.maps.MapTypeControl()
            map.addControl(mapTypeControl, kakao.maps.ControlPosition.TOPRIGHT)

            const zoomControl = new kakao.maps.ZoomControl()
            map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT)

        } catch (e) {
            console.error("Failed to initialize Kakao map:", e)
            setError("지도를 불러올 수 없습니다.")
        }
    }, [mapLoaded, latitude, longitude])

    if (!latitude || !longitude || latitude === 0 || longitude === 0) {
        return (
            <div
                className={`bg-muted flex flex-col items-center justify-center text-muted-foreground rounded-md border ${className}`}
                style={{ width, height }}
            >
                <MapPin className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">위치 정보(GPS)가 없습니다</p>
            </div>
        )
    }

    if (error) {
        return (
            <div
                className={`bg-red-50 text-red-500 flex flex-col items-center justify-center rounded-md border ${className}`}
                style={{ width, height }}
            >
                <p className="text-sm font-medium">{error}</p>
                <p className="text-xs mt-1">도메인 등록 여부를 확인해주세요.</p>
            </div>
        )
    }

    return (
        <div
            ref={mapRef}
            className={`rounded-md border overflow-hidden shadow-inner ${className}`}
            style={{ width, height }}
        >
            {!mapLoaded && (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            )}
        </div>
    )
}
