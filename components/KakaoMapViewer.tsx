"use client"

import { useEffect, useRef, useState } from "react"
import Script from "next/script"
import { Loader2 } from "lucide-react"

interface KakaoMapViewerProps {
    latitude: number
    longitude: number
    level?: number
}

declare global {
    interface Window {
        kakao: any
    }
}

export default function KakaoMapViewer({
    latitude,
    longitude,
    level = 3,
}: KakaoMapViewerProps) {
    const mapRef = useRef<HTMLDivElement>(null)
    const [isLoaded, setIsLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (isLoaded && window.kakao && mapRef.current) {
            try {
                window.kakao.maps.load(() => {
                    const container = mapRef.current
                    const options = {
                        center: new window.kakao.maps.LatLng(latitude, longitude),
                        level: level,
                    }

                    const map = new window.kakao.maps.Map(container, options)

                    // 마커 생성
                    const markerPosition = new window.kakao.maps.LatLng(latitude, longitude)
                    const marker = new window.kakao.maps.Marker({
                        position: markerPosition,
                    })

                    marker.setMap(map)

                    // 지도 타입 컨트롤 (일반/스카이뷰)
                    const mapTypeControl = new window.kakao.maps.MapTypeControl()
                    map.addControl(mapTypeControl, window.kakao.maps.ControlPosition.TOPRIGHT)

                    // 줌 컨트롤
                    const zoomControl = new window.kakao.maps.ZoomControl()
                    map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT)
                })
            } catch (err) {
                console.error("Kakao Map Init Error:", err)
                setError("지도 초기화 중 오류가 발생했습니다.")
            }
        }
    }, [isLoaded, latitude, longitude, level])

    const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY || 'ab078a7e191331be76723480bb11bb50'

    return (
        <div className="relative h-full w-full bg-gray-100">
            <Script
                src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&libraries=services,clusterer,drawing&autoload=false`}
                strategy="afterInteractive"
                onLoad={() => setIsLoaded(true)}
                onError={(e) => {
                    console.error("Kakao Script Load Error", e)
                    setError("지도 스크립트를 로드할 수 없습니다.")
                }}
            />

            {!isLoaded && !error && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex items-center justify-center text-red-500">
                    {error}
                </div>
            )}

            <div ref={mapRef} className="h-full w-full" />
        </div>
    )
}
