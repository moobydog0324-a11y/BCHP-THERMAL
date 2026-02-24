import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: '반월 열병합 열배관 관리시스템 | BCHP Thermal Pipe Management',
  description: '열화상 데이터 기반 배관 건전성 관리 플랫폼 - BCHP Thermal Pipe Health Management System',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

import Script from 'next/script'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <Script
          src="//dapi.kakao.com/v2/maps/sdk.js?appkey=ab078a7e191331be76723480bb11bb50&libraries=services,clusterer,drawing&autoload=false"
          strategy="beforeInteractive"
        />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
