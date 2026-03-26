'use client'

import { useReportWebVitals } from 'next/web-vitals'
import { useEffect } from 'react'

export default function WebVitals() {
  useReportWebVitals((metric) => {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${metric.name}]`, metric.value.toFixed(2))
    }

    // Optionally send to an API endpoint for monitoring
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      // Only send from non-localhost in production
      try {
        fetch('/api/vitals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: metric.name,
            value: metric.value,
            rating: metric.rating,
            delta: (metric as any).delta,
            id: metric.id,
            navigationType: (metric as any).navigationType,
          }),
          // Use sendBeacon for reliability
          keepalive: true,
        }).catch(() => {
          // Silently fail if API is not available
        })
      } catch (_) {
        // Ignore errors
      }
    }
  })

  return null
}
