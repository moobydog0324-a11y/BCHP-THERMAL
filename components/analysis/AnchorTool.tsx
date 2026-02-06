"use client"

import React, { useRef, useEffect, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Crosshair, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react'

interface Point {
    x: number
    y: number
    label?: string
}

interface AnchorToolProps {
    imageUrl: string
    points: Point[]
    onPointsChange: (points: Point[]) => void
    maxPoints?: number
    labelPrefix?: string
}

export default function AnchorTool({
    imageUrl,
    points,
    onPointsChange,
    maxPoints = 3,
    labelPrefix = "P"
}: AnchorToolProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(1)
    const [image, setImage] = useState<HTMLImageElement | null>(null)
    const [offset, setOffset] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

    // 이미지 로드
    useEffect(() => {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.src = imageUrl
        img.onload = () => {
            setImage(img)
            fitImageToContainer(img)
        }
    }, [imageUrl])

    // 캔버스 다시 그리기
    useEffect(() => {
        draw()
    }, [image, points, scale, offset])

    const fitImageToContainer = (img: HTMLImageElement) => {
        if (!containerRef.current) return
        const containerWidth = containerRef.current.clientWidth
        const containerHeight = containerRef.current.clientHeight

        const scaleW = containerWidth / img.width
        const scaleH = containerHeight / img.height
        const newScale = Math.min(scaleW, scaleH) * 0.9 // 90% fit

        setScale(newScale)

        // Center image
        setOffset({
            x: (containerWidth - img.width * newScale) / 2,
            y: (containerHeight - img.height * newScale) / 2
        })
    }

    const draw = () => {
        const canvas = canvasRef.current
        if (!canvas || !image) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // 캔버스 크기를 컨테이너에 맞춤
        if (containerRef.current) {
            canvas.width = containerRef.current.clientWidth
            canvas.height = containerRef.current.clientHeight
        }

        // Clear
        ctx.fillStyle = "#1e1e1e" // Dark background
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        ctx.save()
        // Transform
        ctx.translate(offset.x, offset.y)
        ctx.scale(scale, scale)

        // Draw Image
        ctx.drawImage(image, 0, 0)

        // Draw Points
        points.forEach((p, idx) => {
            const x = p.x * image.width
            const y = p.y * image.height

            // Circle
            ctx.beginPath()
            ctx.arc(x, y, 5 / scale, 0, 2 * Math.PI) // Scale invariant size
            ctx.fillStyle = "rgba(255, 0, 0, 0.5)"
            ctx.fill()
            ctx.lineWidth = 2 / scale
            ctx.strokeStyle = "red"
            ctx.stroke()

            // Crosshair
            ctx.beginPath()
            ctx.moveTo(x - 10 / scale, y)
            ctx.lineTo(x + 10 / scale, y)
            ctx.moveTo(x, y - 10 / scale)
            ctx.lineTo(x, y + 10 / scale)
            ctx.strokeStyle = "yellow"
            ctx.lineWidth = 1 / scale
            ctx.stroke()

            // Label
            ctx.font = `${14 / scale}px Arial`
            ctx.fillStyle = "yellow"
            ctx.fillText(`${labelPrefix}${idx + 1}`, x + 8 / scale, y - 8 / scale)
        })

        ctx.restore()
    }

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1 || e.shiftKey) { // Middle click or Shift+Click to Pan
            setIsDragging(true)
            setDragStart({ x: e.clientX, y: e.clientY })
            return
        }

        if (!image) return
        const canvas = canvasRef.current
        if (!canvas) return

        // 좌표 변환 (Screen -> Canvas -> Image Normalized)
        const rect = canvas.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        // Apply transform inverse
        const imgX = (mouseX - offset.x) / scale
        const imgY = (mouseY - offset.y) / scale

        // Check bounds
        if (imgX >= 0 && imgX <= image.width && imgY >= 0 && imgY <= image.height) {
            // Add Point
            if (points.length < maxPoints) {
                const newPoint = {
                    x: imgX / image.width,
                    y: imgY / image.height,
                    label: `${labelPrefix}${points.length + 1}`
                }
                onPointsChange([...points, newPoint])
            }
        }
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            const dx = e.clientX - dragStart.x
            const dy = e.clientY - dragStart.y
            setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
            setDragStart({ x: e.clientX, y: e.clientY })
        }
    }

    const handleMouseUp = () => {
        setIsDragging(false)
    }

    const handleWheel = (e: React.WheelEvent) => {
        // Zoom
        const zoomSensitivity = 0.1
        const delta = -Math.sign(e.deltaY) * zoomSensitivity
        const newScale = Math.max(0.1, Math.min(10, scale + delta))

        // Zoom toward center (simplified) -> Better: Zoom towards mouse
        // For MVP, simplified center zoom
        setScale(newScale)
    }

    return (
        <div className="flex flex-col gap-2 h-full">
            <div className="flex justify-between items-center bg-muted p-2 rounded-t-lg">
                <div className="text-sm font-medium">
                    기준점 선택 ({points.length}/{maxPoints})
                </div>
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setScale(s => s + 0.1)}><ZoomIn className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.max(0.1, s - 0.1))}><ZoomOut className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (image) fitImageToContainer(image) }}><RefreshCw className="w-4 h-4" /></Button>
                    <Button variant="destructive" size="sm" onClick={() => onPointsChange([])} disabled={points.length === 0}>초기화</Button>
                </div>
            </div>
            <div
                ref={containerRef}
                className="flex-1 bg-gray-900 rounded-b-lg overflow-hidden relative cursor-crosshair border border-border"
                style={{ minHeight: '400px' }}
            >
                <canvas
                    ref={canvasRef}
                    className="w-full h-full block"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                    onContextMenu={(e) => e.preventDefault()}
                />
                {!image && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                        이미지 로드 중...
                    </div>
                )}
            </div>
            <div className="text-xs text-muted-foreground">
                * Shift + 드래그 또는 마우스 휠로 확대/축소 및 이동 가능
            </div>
        </div>
    )
}
