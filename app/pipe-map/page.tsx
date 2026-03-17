'use client'

import AppNavbar from '@/components/AppNavbar'
import PipeMapContainer from '@/components/map/PipeMapContainer'

export default function PipeMapPage() {
  return (
    <div className="flex flex-col h-screen">
      <AppNavbar />
      <main className="flex-1 overflow-hidden">
        <PipeMapContainer />
      </main>
    </div>
  )
}
