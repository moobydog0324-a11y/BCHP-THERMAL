"use client"

import React, { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, CheckCircle2, AlertCircle, Wand2, MousePointer2 } from "lucide-react"
import AnchorTool from "@/components/analysis/AnchorTool"

// Type Definitions
interface ThermalImage {
    image_id: number
    image_url: string
    capture_timestamp: string
    gps: any
}

interface Point {
    x: number
    y: number
    label?: string
}

export default function AnalysisPage() {
    const params = useParams()
    const section = params.section as string
    const router = useRouter()

    // State
    const [images, setImages] = useState<ThermalImage[]>([])
    const [loading, setLoading] = useState(false)

    // Selection
    const [masterId, setMasterId] = useState<number | null>(null)
    const [targetId, setTargetId] = useState<number | null>(null)

    // Alignment Data
    const [masterAnchors, setMasterAnchors] = useState<Point[]>([])
    const [targetAnchors, setTargetAnchors] = useState<Point[]>([]) // For Manual Alignment
    const [alignmentResult, setAlignmentResult] = useState<any>(null)
    const [isAligning, setIsAligning] = useState(false)

    // Load Images on Mount
    useEffect(() => {
        if (section) {
            fetchImages(section)
        }
    }, [section])

    const fetchImages = async (sec: string) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/thermal-images/by-section/${sec}`)
            const data = await res.json()
            if (data.success) {
                // Filter only thermal images and sort by date
                const thermal = data.data
                    .filter((img: any) => img.image_type === 'thermal')
                    .sort((a: any, b: any) => new Date(a.capture_timestamp).getTime() - new Date(b.capture_timestamp).getTime())
                setImages(thermal)
            }
        } catch (e) {
            console.error("Failed to load images", e)
        } finally {
            setLoading(false)
        }
    }

    // --- Handlers ---

    const handleAutoAlign = async () => {
        if (!masterId || !targetId) return

        const master = images.find(i => i.image_id === masterId)
        const target = images.find(i => i.image_id === targetId)
        if (!master || !target) return

        setIsAligning(true)
        try {
            const res = await fetch('/api/analysis/align/auto', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    master_url: master.image_url,
                    target_url: target.image_url
                })
            })
            const data = await res.json()
            if (data.success) {
                setAlignmentResult(data)
            } else {
                alert("자동 정합 실패: " + data.error)
            }
        } catch (e) {
            console.error(e)
            alert("서버 오류 발생")
        } finally {
            setIsAligning(false)
        }
    }

    const handleManualAlign = async () => {
        // 백엔드 구현 필요 (현재 UI만 구성)
        alert("수동 정합 기능은 준비 중입니다.")
    }

    const getMasterImage = () => images.find(i => i.image_id === masterId)
    const getTargetImage = () => images.find(i => i.image_id === targetId)

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b bg-card">
                <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/thermal-analysis">
                            <Button variant="ghost" size="icon"><ArrowLeft /></Button>
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold">정밀 시계열 분석</h1>
                            <p className="text-xs text-muted-foreground">구역: {section}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {/* Global Actions */}
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-6 py-6 grid gap-6 lg:grid-cols-[300px_1fr]">

                {/* Sidebar: Image Selection */}
                <aside className="space-y-4">
                    <Card className="p-4 bg-card h-[calc(100vh-120px)] flex flex-col">
                        <h2 className="text-sm font-semibold mb-3">이미지 목록 ({images.length})</h2>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                            {loading && <div className="text-center p-4">Loading...</div>}
                            {images.map(img => (
                                <div
                                    key={img.image_id}
                                    className={`
                                p-2 border rounded-lg cursor-pointer transition-all flex gap-3
                                ${masterId === img.image_id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}
                                ${targetId === img.image_id ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : ''}
                                hover:bg-accent
                            `}
                                    onClick={() => {
                                        // Simple toggle logic for demo
                                        if (!masterId) setMasterId(img.image_id)
                                        else if (masterId === img.image_id) setMasterId(null)
                                        else if (!targetId) setTargetId(img.image_id)
                                        else setTargetId(img.image_id)
                                    }}
                                >
                                    <div className="relative w-16 h-12 bg-black rounded overflow-hidden flex-shrink-0">
                                        <Image src={img.image_url} alt="" fill className="object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium truncate">
                                            {new Date(img.capture_timestamp).toLocaleDateString()}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">
                                            {masterId === img.image_id && <span className="text-blue-600 font-bold">MASTER</span>}
                                            {targetId === img.image_id && <span className="text-orange-600 font-bold">TARGET</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                            <p>1. <strong>Master</strong> 클릭 (파란색)</p>
                            <p>2. <strong>Target</strong> 클릭 (주황색)</p>
                        </div>
                    </Card>
                </aside>

                {/* Main Content */}
                <div className="space-y-6">

                    {/* Step 1: Master Anchor Selection */}
                    {masterId && (
                        <Card className="p-4">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-blue-500" />
                                    Step 1: 기준 이미지 설정 (Master)
                                </h2>
                                <div className="text-sm text-muted-foreground">
                                    {new Date(getMasterImage()?.capture_timestamp || "").toLocaleString()}
                                </div>
                            </div>
                            <div className="h-[500px] border rounded bg-black">
                                <AnchorTool
                                    imageUrl={getMasterImage()?.image_url || ""}
                                    points={masterAnchors}
                                    onPointsChange={setMasterAnchors}
                                    maxPoints={4}
                                    labelPrefix="M"
                                />
                            </div>
                            <div className="mt-2 text-sm text-muted-foreground">
                                * 변하지 않는 구조물(배관 모서리, 지지대 등) 3곳 이상을 찍어주세요.
                            </div>
                        </Card>
                    )}

                    {/* Step 2: Alignment (Target) */}
                    {masterId && targetId && (
                        <Card className="p-4 border-orange-200 dark:border-orange-800">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <Wand2 className="w-5 h-5 text-orange-500" />
                                    Step 2: 정합 수행 (Align)
                                </h2>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleAutoAlign}
                                        disabled={isAligning}
                                        className="bg-orange-600 hover:bg-orange-700"
                                    >
                                        {isAligning ? "처리중..." : "⚡ 자동 정합"}
                                    </Button>
                                    <Button variant="outline" disabled>수동 정합 (준비중)</Button>
                                </div>
                            </div>

                            {/* Compare View - Left: Master(Overlay), Right: Target Result */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h3 className="text-sm font-semibold mb-2">Target Image (Original)</h3>
                                    <div className="aspect-video bg-black rounded overflow-hidden relative">
                                        <Image
                                            src={getTargetImage()?.image_url || ""}
                                            alt="Target"
                                            fill
                                            className="object-contain"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold mb-2">Alignment Result</h3>
                                    <div className="aspect-video bg-black rounded overflow-hidden relative flex items-center justify-center text-muted-foreground">
                                        {alignmentResult ? (
                                            <div className="absolute inset-0">
                                                {/* 
                                            실제 구현에서는 백엔드에서 Warped Image를 받아와야 하지만,
                                            지금은 CSS Transform으로 Matrix를 적용해 보여줄 수도 있음.
                                            (단, 백엔드 로직 검증을 위해 여기서는 텍스트로 결과 표시)
                                        */}
                                                <div className="p-4 text-green-500 font-mono text-xs overflow-auto h-full">
                                                    <p className="font-bold text-lg mb-2">✅ 정합 성공!</p>
                                                    <p>Score: {(alignmentResult.score * 100).toFixed(1)}%</p>
                                                    <pre>{JSON.stringify(alignmentResult.matrix, null, 2)}</pre>
                                                </div>
                                            </div>
                                        ) : (
                                            <p>자동 정합 버튼을 눌러주세요</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {!masterId && (
                        <div className="h-64 flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                            왼쪽 목록에서 Master 이미지를 먼저 선택해주세요.
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
