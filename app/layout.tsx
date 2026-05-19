import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gold Tracker — Harga Emas Keluarga',
  description: 'Pantau harga emas Antam, International, dan Nasril secara real-time. Chart interaktif dengan Moving Average untuk keputusan beli/jual yang lebih baik.',
  keywords: ['harga emas', 'antam', 'gold price', 'investasi emas'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <body>
        <div style={{ position: 'relative', zIndex: 1 }}>
          {children}
        </div>
      </body>
    </html>
  )
}
