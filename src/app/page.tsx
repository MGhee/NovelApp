'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const HomePageInnerDynamic = dynamic(() => import('./page-inner'), {
  loading: () => <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }} />,
  ssr: false,
})

export default function HomePage() {
  return (
    <Suspense>
      <HomePageInnerDynamic />
    </Suspense>
  )
}
